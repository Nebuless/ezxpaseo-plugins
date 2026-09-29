import {
  AGENT_SOURCE,
  AGENT_STATE,
  MAX_AGENT_ATTEMPT,
  MAX_LABEL_LENGTH,
  MAX_ROLE_LENGTH,
  MAX_STATUS_BUFFER_LENGTH,
  MAX_TOOL_NAME_LENGTH,
  PI_WORKFLOW_SUBAGENTS_PROTOCOL_VERSION,
  TOOL_STATE,
  UNSUPPORTED_CODE,
  companionMessageSchema,
  standaloneAgentStatusSchema,
  workflowAgentStatusSchema,
} from "../shared/subagent-schema.mjs";
import {
  clearTimeout as clearNodeTimeout,
  setTimeout as setNodeTimeout,
} from "node:timers";

const WORKFLOW_EVENT = "workflow:agent-state-changed";
const HEARTBEAT_INTERVAL_MS = 10_000;
const BRIDGE_REQUEST_TIMEOUT_MS = 2_500;
/** @typedef {import("../shared/subagents.js").WorkflowAgentStatus} WorkflowAgentStatus */
/** @typedef {import("../shared/subagents.js").StandaloneAgentStatus} StandaloneAgentStatus */
/** @typedef {import("../shared/subagents.js").UnsupportedCode} UnsupportedCode */
/** @typedef {import("./observer.d.mts").PiWorkflowFetch} PiWorkflowFetch */
/** @typedef {import("./observer.d.mts").PiWorkflowFetchRequestInit} PiWorkflowFetchRequestInit */
/** @typedef {import("./observer.d.mts").PiWorkflowIntervalHandle} PiWorkflowIntervalHandle */
/** @typedef {{(this: unknown, status: unknown, request: unknown): unknown}} RegistryObserver */
/** @typedef {{original: Function, wrapper: RegistryObserver, listeners: Set<(status: unknown, request: unknown) => void>}} RegistryBinding */

/** @type {Readonly<Record<string, WorkflowAgentStatus["state"] | undefined>>} */
const WORKFLOW_STATE = Object.freeze({
  queued: AGENT_STATE.PENDING,
  running: AGENT_STATE.RUNNING,
  waiting_for_child: AGENT_STATE.WAITING_FOR_CHILD,
  paused: AGENT_STATE.PAUSED,
  retrying: AGENT_STATE.RETRYING,
  completed: AGENT_STATE.COMPLETED,
  failed: AGENT_STATE.FAILED,
  cancelled: AGENT_STATE.CANCELLED,
});
/** @type {Readonly<Record<string, StandaloneAgentStatus["state"] | undefined>>} */
const STANDALONE_STATE = Object.freeze({
  running: AGENT_STATE.RUNNING,
  completed: AGENT_STATE.COMPLETED,
  failed: AGENT_STATE.FAILED,
  stopped: AGENT_STATE.STOPPED,
});
/** @type {WeakMap<Record<string, unknown>, RegistryBinding>} */
const registryBindings = new WeakMap();

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @param {unknown} value @param {number} maxLength */
function safeDisplayText(value, maxLength) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (
    text.length === 0 ||
    text.length > maxLength ||
    /[\u0000-\u001f\u007f]/u.test(text)
  ) {
    return undefined;
  }
  return text;
}

/** @param {unknown} value */
function safeAttempt(value) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_AGENT_ATTEMPT
    ? value
    : undefined;
}

/** @param {unknown} value @returns {value is NonNullable<StandaloneAgentStatus["toolState"]>} */
function isToolState(value) {
  return Object.values(TOOL_STATE).some((state) => state === value);
}

/** @param {unknown} value @param {() => number} now */
function isoTimestamp(value, now) {
  const fallback = now();
  const timestamp =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  try {
    return new Date(timestamp).toISOString();
  } catch {
    return new Date(
      Number.isFinite(fallback) ? fallback : Date.now(),
    ).toISOString();
  }
}

/**
 * @template {Record<string, unknown>} T
 * @param {{safeParse: (value: unknown) => {success: true, data: T} | {success: false}}} schema
 * @param {Record<string, unknown>} fields
 */
function parseStatus(schema, fields) {
  const parsed = schema.safeParse(fields);
  if (parsed.success) return parsed.data;
  if (Object.hasOwn(fields, "attempt")) {
    const withoutAttempt = { ...fields };
    delete withoutAttempt.attempt;
    const fallback = schema.safeParse(withoutAttempt);
    if (fallback.success) return fallback.data;
  }
  return undefined;
}

/**
 * Project one workflow lifecycle event onto the shared, privacy-filtered status contract.
 * @param {unknown} value
 * @param {string} piSessionId
 * @param {() => number} [now]
 */
export function projectWorkflowStatus(value, piSessionId, now = Date.now) {
  try {
    if (!isRecord(value) || value.sessionId !== piSessionId) return undefined;
    if (typeof value.state !== "string") return undefined;
    const state = WORKFLOW_STATE[value.state];
    if (
      !state ||
      typeof value.runId !== "string" ||
      typeof value.agentId !== "string"
    ) {
      return undefined;
    }

    /** @type {Record<string, unknown>} */
    const fields = {
      piSessionId,
      source: AGENT_SOURCE.WORKFLOW,
      runId: value.runId,
      agentId: value.agentId,
      state,
      updatedAt: isoTimestamp(value.timestamp, now),
    };
    const label = safeDisplayText(value.displayLabel, MAX_LABEL_LENGTH);
    const role = safeDisplayText(value.role, MAX_ROLE_LENGTH);
    const attempt = safeAttempt(value.attempt);
    if (label) fields.label = label;
    if (role) fields.role = role;
    if (attempt !== undefined) fields.attempt = attempt;
    return parseStatus(workflowAgentStatusSchema, fields);
  } catch {
    return undefined;
  }
}

/**
 * Project one Pi workflow extension registry status onto the shared status contract.
 * @param {unknown} value
 * @param {unknown} request
 * @param {string} piSessionId
 * @param {() => number} [now]
 */
export function projectStandaloneStatus(
  value,
  request,
  piSessionId,
  now = Date.now,
) {
  try {
    if (
      !isRecord(value) ||
      value.sessionId !== piSessionId ||
      typeof value.id !== "string" ||
      typeof value.state !== "string"
    ) {
      return undefined;
    }
    const state = STANDALONE_STATE[value.state];
    if (!state) return undefined;

    const progress = isRecord(value.progress) ? value.progress : undefined;
    const updatedAtSource =
      progress?.lastEventAt ?? value.finishedAt ?? value.startedAt;
    /** @type {Record<string, unknown>} */
    const fields = {
      piSessionId,
      source: AGENT_SOURCE.STANDALONE,
      agentId: value.id,
      state,
      updatedAt: isoTimestamp(updatedAtSource, now),
    };
    const label = isRecord(request)
      ? safeDisplayText(request.label, MAX_LABEL_LENGTH)
      : undefined;
    const role = isRecord(request)
      ? safeDisplayText(request.role, MAX_ROLE_LENGTH)
      : undefined;
    const attempt = safeAttempt(value.attempts);
    if (label) fields.label = label;
    if (role) fields.role = role;
    if (attempt !== undefined) fields.attempt = attempt;

    const toolCalls = progress?.toolCalls;
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      const latest = toolCalls[toolCalls.length - 1];
      if (isRecord(latest)) {
        const toolName = safeDisplayText(latest.name, MAX_TOOL_NAME_LENGTH);
        if (toolName && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u.test(toolName)) {
          fields.toolName = toolName;
        }
        if (isToolState(latest.state)) {
          fields.toolState = latest.state;
        }
      }
    }
    return parseStatus(standaloneAgentStatusSchema, fields);
  } catch {
    return undefined;
  }
}

/** @param {string} bridgeUrl */
function statusEndpoint(bridgeUrl) {
  try {
    const endpoint = new URL(bridgeUrl);
    const hostname = endpoint.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
    if (
      endpoint.protocol !== "http:" ||
      !["127.0.0.1", "::1", "localhost"].includes(hostname) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    ) {
      return undefined;
    }
    endpoint.pathname = `${endpoint.pathname.replace(/\/+$/u, "")}/status`;
    return endpoint.href;
  } catch {
    return undefined;
  }
}

/**
 * Pi runs on Node's native fetch. React Native's ambient globals give this
 * workspace an incompatible RequestInit.signal type, so keep that mismatch
 * at this one runtime boundary rather than weakening the injectable contract.
 * @param {string} endpoint
 * @param {PiWorkflowFetchRequestInit} init
 */
function nodeFetch(endpoint, init) {
  // @ts-expect-error Node's native fetch accepts its AbortController signal; the imported React Native globals declare a conflicting signal type.
  return globalThis.fetch(endpoint, init);
}

/**
 * @param {string} endpoint
 * @param {string} token
 * @param {PiWorkflowFetch} fetchImpl
 */
function createBridgeSender(endpoint, token, fetchImpl) {
  let queue = Promise.resolve();
  let pending = 0;
  let accepting = true;
  let aborted = false;
  /** @type {Set<AbortController>} */
  const activeRequests = new Set();

  const abortRequests = () => {
    aborted = true;
    for (const controller of activeRequests) controller.abort();
    activeRequests.clear();
  };

  /** @param {unknown} message */
  const send = (message) => {
    if (!accepting || aborted || pending >= MAX_STATUS_BUFFER_LENGTH) {
      return Promise.resolve();
    }
    const parsed = companionMessageSchema.safeParse(message);
    if (!parsed.success) return Promise.resolve();

    pending += 1;
    const task = queue
      .then(async () => {
        if (aborted) return;
        const controller = new AbortController();
        activeRequests.add(controller);
        const timeout = setNodeTimeout(
          () => controller.abort(),
          BRIDGE_REQUEST_TIMEOUT_MS,
        );
        try {
          /** @type {PiWorkflowFetchRequestInit} */
          const requestInit = {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(parsed.data),
            redirect: "error",
            signal: controller.signal,
          };
          await fetchImpl(endpoint, requestInit);
        } catch {
          // Bridge failures must not affect workflow or standalone-agent execution.
        } finally {
          clearNodeTimeout(timeout);
          activeRequests.delete(controller);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        pending -= 1;
      });
    queue = task;
    return task;
  };

  return {
    send,
    flush: () => queue,
    close: ({ drain = false } = {}) => {
      accepting = false;
      if (drain) {
        void queue.finally(abortRequests);
      } else {
        abortRequests();
      }
    },
  };
}

/**
 * @param {Record<string, unknown>} registry
 * @param {(status: unknown, request: unknown) => void} listener
 */
function acquireRegistryObserver(registry, listener) {
  let binding = registryBindings.get(registry);
  if (binding) {
    if (registry.observeSubagentStatus !== binding.wrapper) return undefined;
    binding.listeners.add(listener);
  } else {
    const original = registry.observeSubagentStatus;
    if (typeof original !== "function") return undefined;
    const listeners = new Set([listener]);
    /** @type {RegistryObserver} @this {unknown} @param {unknown} status @param {unknown} request */
    const wrapper = function (status, request) {
      const result = Reflect.apply(original, this, [status, request]);
      for (const currentListener of listeners) {
        try {
          currentListener(status, request);
        } catch {
          // Monitoring callbacks are isolated from the original registry observer.
        }
      }
      return result;
    };
    try {
      if (!Reflect.set(registry, "observeSubagentStatus", wrapper))
        return undefined;
    } catch {
      return undefined;
    }
    if (registry.observeSubagentStatus !== wrapper) return undefined;
    binding = { original, wrapper, listeners };
    registryBindings.set(registry, binding);
  }

  let released = false;
  return {
    wrapper: binding.wrapper,
    release: () => {
      if (released) return;
      released = true;
      binding.listeners.delete(listener);
      if (binding.listeners.size === 0) {
        if (registry.observeSubagentStatus === binding.wrapper) {
          try {
            Reflect.set(registry, "observeSubagentStatus", binding.original);
          } catch {
            // Do not replace a method owned by another extension during cleanup.
          }
        }
        registryBindings.delete(registry);
      }
    },
  };
}

/**
 * Start the session-scoped Pi companion observer. Missing bridge configuration is opt-out.
 * @param {import("./observer.d.mts").PiWorkflowObserverOptions} options
 */
export function startPiWorkflowSubagentObserver(options) {
  const inactive = {
    active: false,
    stop() {},
    flush: () => Promise.resolve(),
  };
  if (
    typeof options.piSessionId !== "string" ||
    !options.piSessionId ||
    typeof options.bridgeUrl !== "string" ||
    !options.bridgeUrl ||
    typeof options.bridgeToken !== "string" ||
    !options.bridgeToken ||
    /[\u0000-\u001f\u007f]/u.test(options.bridgeToken) ||
    typeof options.loadingRegistry !== "function"
  ) {
    return inactive;
  }

  const endpoint = statusEndpoint(options.bridgeUrl);
  if (!endpoint) return inactive;
  const fetchImpl = options.fetchImpl ?? nodeFetch;
  if (typeof fetchImpl !== "function") return inactive;
  const now = options.now ?? Date.now;
  const setIntervalImpl = options.setIntervalImpl ?? setInterval;
  const clearIntervalImpl = options.clearIntervalImpl ?? clearInterval;
  const sender = createBridgeSender(endpoint, options.bridgeToken, fetchImpl);
  /** @type {Map<Record<string, unknown>, {wrapper: RegistryObserver, release: () => void}>} */
  const localBindings = new Map();
  let active = true;
  let disposed = false;
  /** @type {PiWorkflowIntervalHandle | undefined} */
  let timer;
  /** @type {(() => void) | undefined} */
  let unsubscribe;

  const releaseBindings = () => {
    for (const binding of localBindings.values()) binding.release();
    localBindings.clear();
  };
  const dispose = ({ drain = false } = {}) => {
    if (disposed) return;
    disposed = true;
    active = false;
    if (timer !== undefined) clearIntervalImpl(timer);
    timer = undefined;
    try {
      unsubscribe?.();
    } catch {
      // Event-bus cleanup is best effort.
    }
    unsubscribe = undefined;
    releaseBindings();
    sender.close({ drain });
  };
  /** @param {UnsupportedCode} code */
  const failUnsupported = (code) => {
    if (disposed) return;
    const message = sender.send({
      type: "unsupported",
      piSessionId: options.piSessionId,
      code,
    });
    dispose({ drain: true });
    void message.finally(() => sender.close());
  };

  /** @param {unknown} status @param {unknown} request */
  const onStandaloneStatus = (status, request) => {
    if (!active) return;
    const projected = projectStandaloneStatus(
      status,
      request,
      options.piSessionId,
      now,
    );
    if (projected) {
      void sender.send({
        type: "update",
        piSessionId: options.piSessionId,
        status: projected,
      });
    }
  };

  const rebindRegistry = () => {
    if (!active) return false;
    /** @type {unknown} */
    let registry;
    try {
      registry = options.loadingRegistry();
    } catch {
      failUnsupported(UNSUPPORTED_CODE.MISSING_REGISTRY_OBSERVER);
      return false;
    }
    if (
      !isRecord(registry) ||
      typeof registry.observeSubagentStatus !== "function"
    ) {
      failUnsupported(UNSUPPORTED_CODE.MISSING_REGISTRY_OBSERVER);
      return false;
    }

    const existing = localBindings.get(registry);
    if (existing) {
      if (registry.observeSubagentStatus === existing.wrapper) return true;
      failUnsupported(UNSUPPORTED_CODE.MISSING_REGISTRY_OBSERVER);
      return false;
    }

    for (const [previousRegistry, binding] of localBindings) {
      if (previousRegistry !== registry) {
        binding.release();
        localBindings.delete(previousRegistry);
      }
    }
    const binding = acquireRegistryObserver(registry, onStandaloneStatus);
    if (!binding) {
      failUnsupported(UNSUPPORTED_CODE.MISSING_REGISTRY_OBSERVER);
      return false;
    }
    localBindings.set(registry, binding);
    return true;
  };

  if (!rebindRegistry()) return { ...inactive, flush: () => sender.flush() };
  const events =
    isRecord(options.pi) && isRecord(options.pi.events)
      ? options.pi.events
      : undefined;
  if (!events || typeof events.on !== "function") {
    failUnsupported(UNSUPPORTED_CODE.MISSING_WORKFLOW_EVENTS);
    return { ...inactive, flush: () => sender.flush() };
  }

  try {
    unsubscribe = events.on(WORKFLOW_EVENT, (/** @type {unknown} */ event) => {
      if (!active) return;
      if (!rebindRegistry()) return;
      const projected = projectWorkflowStatus(event, options.piSessionId, now);
      if (projected) {
        void sender.send({
          type: "update",
          piSessionId: options.piSessionId,
          status: projected,
        });
      }
    });
    if (typeof unsubscribe !== "function") {
      failUnsupported(UNSUPPORTED_CODE.MISSING_WORKFLOW_EVENTS);
      return { ...inactive, flush: () => sender.flush() };
    }
  } catch {
    failUnsupported(UNSUPPORTED_CODE.MISSING_WORKFLOW_EVENTS);
    return { ...inactive, flush: () => sender.flush() };
  }

  void sender.send({
    type: "hello",
    piSessionId: options.piSessionId,
    protocolVersion: PI_WORKFLOW_SUBAGENTS_PROTOCOL_VERSION,
  });
  timer = setIntervalImpl(() => {
    if (!active) return;
    if (rebindRegistry()) {
      void sender.send({ type: "heartbeat", piSessionId: options.piSessionId });
    }
  }, HEARTBEAT_INTERVAL_MS);
  if (typeof timer === "object") timer.unref?.();

  return {
    get active() {
      return active;
    },
    stop: () => dispose(),
    flush: () => sender.flush(),
  };
}
