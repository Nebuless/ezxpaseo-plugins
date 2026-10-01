import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AGENT_STATE,
  UNSUPPORTED_CODE,
  companionMessageSchema,
} from "../shared/subagent-schema.mjs";
import {
  loadingRegistry,
  resetWorkflowRegistry,
} from "pi-extensible-workflows/registry";
import {
  projectStandaloneStatus,
  projectWorkflowStatus,
  startPiWorkflowSubagentObserver,
} from "./observer.mjs";

const PI_SESSION_ID = "pi-session-1";
const BRIDGE_URL = "http://127.0.0.1:3210";
const BRIDGE_TOKEN = "test-bridge-token";
const FIXED_TIME = Date.parse("2026-09-28T12:34:56.000Z");

/** @typedef {import("../shared/subagents.js").CompanionMessage & {code?: import("../shared/subagents.js").UnsupportedCode, status?: {piSessionId: string, source: "workflow" | "standalone", agentId: string, state: string, runId?: string, attempt?: number}, protocolVersion?: 1}} HarnessMessage */
/** @typedef {{observeSubagentStatus(status: unknown, request: unknown): unknown, setSubagentStatusObserver(observer: ((status: {id: string, state: string}, request: unknown) => void) | undefined): void}} ObserverRegistryHarness */

/** @param {unknown} value @returns {value is ObserverRegistryHarness} */
function isObserverRegistryHarness(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    "observeSubagentStatus" in value &&
    typeof value.observeSubagentStatus === "function" &&
    "setSubagentStatusObserver" in value &&
    typeof value.setSubagentStatusObserver === "function"
  );
}

/** @param {unknown} value @returns {ObserverRegistryHarness} */
function observerRegistryHarness(value) {
  if (!isObserverRegistryHarness(value)) {
    throw new TypeError("Registry observer test seam is unavailable");
  }
  return value;
}

/**
 * @param {{registryLoader?: () => unknown, fetchImpl?: import("./observer.d.mts").PiWorkflowFetch, bridgeUrl?: string, bridgeToken?: string, pi?: import("./observer.d.mts").PiWorkflowObserverOptions["pi"]}} [options]
 */
function createHarness({
  registryLoader = loadingRegistry,
  fetchImpl,
  bridgeUrl = BRIDGE_URL,
  bridgeToken = BRIDGE_TOKEN,
  pi = {},
} = {}) {
  /** @type {HarnessMessage[]} */
  const messages = [];
  /** @type {((value: unknown) => void) | undefined} */
  let workflowListener;
  /** @type {(() => void) | undefined} */
  let intervalCallback;
  /** @type {number | undefined} */
  let intervalDelay;
  let intervalCleared = false;
  const eventBus = {
    /** @param {string} channel @param {(event: unknown) => void} handler */
    on(channel, handler) {
      assert.equal(channel, "workflow:agent-state-changed");
      workflowListener = handler;
      return () => {
        workflowListener = undefined;
      };
    },
  };
  const scheduledPi = {
    events: eventBus,
    ...pi,
  };
  const runtime = startPiWorkflowSubagentObserver({
    pi: scheduledPi,
    piSessionId: PI_SESSION_ID,
    bridgeUrl,
    bridgeToken,
    loadingRegistry: registryLoader,
    fetchImpl:
      fetchImpl ??
      (async (url, options) => {
        assert.equal(url, `${BRIDGE_URL}/status`);
        messages.push(companionMessageSchema.parse(JSON.parse(options.body)));
        return { ok: true, status: 200 };
      }),
    now: () => FIXED_TIME,
    setIntervalImpl: (callback, delay) => {
      intervalCallback = callback;
      intervalDelay = delay;
      return 0;
    },
    clearIntervalImpl: () => {
      intervalCleared = true;
    },
  });

  return {
    runtime,
    messages,
    /** @param {unknown} value */
    emitWorkflow(value) {
      workflowListener?.(value);
    },
    tick() {
      intervalCallback?.();
    },
    get intervalDelay() {
      return intervalDelay;
    },
    get intervalCleared() {
      return intervalCleared;
    },
    get hasWorkflowListener() {
      return typeof workflowListener === "function";
    },
  };
}

test("projects allowlisted workflow and standalone status without leaking source fields", () => {
  const workflow = projectWorkflowStatus(
    {
      sessionId: PI_SESSION_ID,
      runId: "run-1",
      agentId: "agent-1",
      state: "waiting_for_child",
      attempt: 3,
      displayLabel: "Review worker",
      role: "reviewer",
      timestamp: FIXED_TIME,
      cwd: "/private/project",
      runDirectory: "/private/run",
      worktreeOwner: "private-owner",
      parentBreadcrumb: "private-parent",
      prompt: "private prompt",
      error: "private error",
      structuralPath: ["private-path"],
    },
    PI_SESSION_ID,
    () => FIXED_TIME,
  );
  assert.deepEqual(workflow, {
    piSessionId: PI_SESSION_ID,
    source: "workflow",
    runId: "run-1",
    agentId: "agent-1",
    state: AGENT_STATE.WAITING_FOR_CHILD,
    updatedAt: "2026-09-28T12:34:56.000Z",
    attempt: 3,
    label: "Review worker",
    role: "reviewer",
  });
  assert.equal(JSON.stringify(workflow).includes("/private"), false);
  assert.equal(JSON.stringify(workflow).includes("private prompt"), false);
  assert.equal(
    projectWorkflowStatus(
      {
        sessionId: "another-session",
        runId: "run-1",
        agentId: "agent-1",
        state: "running",
      },
      PI_SESSION_ID,
      () => FIXED_TIME,
    ),
    undefined,
  );
  assert.equal(
    projectWorkflowStatus(
      {
        sessionId: PI_SESSION_ID,
        runId: "run-1",
        agentId: "agent-1",
        state: "interrupted",
      },
      PI_SESSION_ID,
      () => FIXED_TIME,
    ),
    undefined,
  );

  const standalone = projectStandaloneStatus(
    {
      id: "agent-1",
      state: "running",
      attempts: 4,
      startedAt: FIXED_TIME - 10_000,
      progress: {
        lastEventAt: FIXED_TIME,
        toolCalls: [
          { name: "shell", state: "running", arguments: "private args" },
        ],
        activity: { text: "private activity" },
      },
      worktree: { path: "/private/worktree", branch: "private-branch" },
      error: { message: "private error" },
      sessionId: PI_SESSION_ID,
      attemptDetails: [{ prompt: "private details" }],
    },
    {
      label: "Subagent",
      role: "reader",
      prompt: "private prompt",
      worktree: "private worktree",
    },
    PI_SESSION_ID,
    () => FIXED_TIME,
  );
  assert.deepEqual(standalone, {
    piSessionId: PI_SESSION_ID,
    source: "standalone",
    agentId: "agent-1",
    state: AGENT_STATE.RUNNING,
    updatedAt: "2026-09-28T12:34:56.000Z",
    attempt: 4,
    label: "Subagent",
    role: "reader",
    toolName: "shell",
    toolState: "running",
  });
  const serialized = JSON.stringify(standalone);
  for (const secret of ["private", "/private", "child-session"]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("forwards only standalone statuses owned by the current Pi session without suppressing upstream callbacks", async () => {
  resetWorkflowRegistry();
  const registry = observerRegistryHarness(loadingRegistry());
  /** @type {Array<{id: string, state: string}>} */
  const observed = [];
  registry.setSubagentStatusObserver((status) => observed.push(status));
  const harness = createHarness();
  try {
    const statuses = [
      { id: "late-agent", state: "completed", sessionId: "previous-session" },
      { id: "unknown-agent", state: "running" },
      { id: "current-agent", state: "running", sessionId: PI_SESSION_ID },
    ];
    for (const status of statuses) registry.observeSubagentStatus(status, {});
    await harness.runtime.flush();
    assert.deepEqual(observed, statuses);
    assert.deepEqual(
      harness.messages
        .filter((message) => message.type === "update")
        .map((message) => message.status.agentId),
      ["current-agent"],
    );
  } finally {
    harness.runtime.stop();
    resetWorkflowRegistry();
  }
});

test("wraps the pinned registry observer, forwards both status sources, and rebinds after registry reset", async () => {
  resetWorkflowRegistry();
  try {
    const firstRegistry = observerRegistryHarness(loadingRegistry());
    const firstOriginalMethod = firstRegistry.observeSubagentStatus;
    const firstSetter = firstRegistry.setSubagentStatusObserver;
    /** @type {Array<{status: {id: string}, request: unknown}>} */
    const observed = [];
    firstRegistry.setSubagentStatusObserver((status, request) => {
      observed.push({ status, request });
    });

    const harness = createHarness();
    assert.equal(harness.runtime.active, true);
    assert.equal(harness.intervalDelay, 10_000);
    assert.equal(firstRegistry.setSubagentStatusObserver, firstSetter);
    await harness.runtime.flush();
    assert.equal(harness.messages[0]?.type, "hello");

    const firstWrapper = firstRegistry.observeSubagentStatus;
    firstRegistry.observeSubagentStatus(
      {
        id: "agent-shared",
        sessionId: PI_SESSION_ID,
        state: "running",
        attempts: 5,
        progress: { lastEventAt: FIXED_TIME, toolCalls: [] },
        worktree: { path: "/private/worktree", branch: "private-branch" },
        error: { message: "private standalone error" },
      },
      {
        label: "Standalone worker",
        role: "reader",
        prompt: "private standalone prompt",
      },
    );
    assert.equal(observed.length, 1);
    assert.equal(observed[0].status.id, "agent-shared");
    assert.equal(harness.runtime.active, true);
    await harness.runtime.flush();

    harness.emitWorkflow({
      sessionId: PI_SESSION_ID,
      runId: "run-1",
      agentId: "agent-shared",
      state: "queued",
      attempt: 7,
      displayLabel: "Workflow worker",
      role: "planner",
      timestamp: FIXED_TIME,
      cwd: "/private/workflow",
      runDirectory: "/private/run",
      worktreeOwner: "private owner",
      parentBreadcrumb: "private parent",
      prompt: "private workflow prompt",
      error: "private workflow error",
    });
    harness.emitWorkflow({
      sessionId: "another-session",
      runId: "run-ignored",
      agentId: "agent-shared",
      state: "running",
      timestamp: FIXED_TIME,
    });
    await harness.runtime.flush();

    const updates = harness.messages.filter(
      (message) => message.type === "update",
    );
    assert.deepEqual(
      updates.map(({ status }) => [
        status.source,
        status.agentId,
        status.state,
      ]),
      [
        ["standalone", "agent-shared", AGENT_STATE.RUNNING],
        ["workflow", "agent-shared", AGENT_STATE.PENDING],
      ],
    );
    assert.equal(updates[0].status.attempt, 5);
    assert.equal(updates[1].status.runId, "run-1");
    assert.equal(updates[1].status.attempt, 7);
    assert.equal(
      updates.every(
        (message) => message.piSessionId === message.status.piSessionId,
      ),
      true,
    );
    const updateText = JSON.stringify(updates);
    for (const secret of [
      "/private",
      "private standalone prompt",
      "private workflow prompt",
      "private owner",
    ]) {
      assert.equal(updateText.includes(secret), false);
    }

    harness.tick();
    await harness.runtime.flush();
    assert.equal(firstRegistry.observeSubagentStatus, firstWrapper);
    assert.equal(
      harness.messages.some((message) => message.type === "heartbeat"),
      true,
    );

    resetWorkflowRegistry();
    const secondRegistry = observerRegistryHarness(loadingRegistry());
    const secondOriginalMethod = secondRegistry.observeSubagentStatus;
    let secondObserved = 0;
    secondRegistry.setSubagentStatusObserver(() => {
      secondObserved += 1;
    });
    harness.tick();
    assert.notEqual(secondRegistry.observeSubagentStatus, secondOriginalMethod);
    assert.equal(firstRegistry.observeSubagentStatus, firstOriginalMethod);
    secondRegistry.observeSubagentStatus(
      {
        id: "new-agent",
        sessionId: PI_SESSION_ID,
        state: "completed",
        attempts: 1,
        finishedAt: FIXED_TIME,
      },
      {
        label: "Replacement",
        role: "worker",
        prompt: "private replacement prompt",
      },
    );
    assert.equal(secondObserved, 1);
    await harness.runtime.flush();
    assert.equal(
      harness.messages.some(
        (message) =>
          message.type === "update" && message.status.agentId === "new-agent",
      ),
      true,
    );

    harness.runtime.stop();
    assert.equal(harness.intervalCleared, true);
    assert.equal(harness.hasWorkflowListener, false);
    assert.equal(secondRegistry.observeSubagentStatus, secondOriginalMethod);
  } finally {
    resetWorkflowRegistry();
  }
});

test("keeps upstream return values and errors, never uses the setter slot, and tolerates bridge failure", async () => {
  const sentinel = new Error("upstream observer error");
  /** @type {Array<{thisValue: unknown, status: unknown, request: unknown}>} */
  const calls = [];
  const registry = {
    /** @param {{id?: string, sessionId?: string, state?: string, throw?: boolean}} status @param {unknown} request */
    observeSubagentStatus(status, request) {
      calls.push({ thisValue: this, status, request });
      if (status.throw) throw sentinel;
      return "upstream-result";
    },
    setSubagentStatusObserver() {
      assert.fail("the companion must not replace the upstream observer");
    },
  };
  const originalMethod = registry.observeSubagentStatus;
  const setter = registry.setSubagentStatusObserver;
  const harness = createHarness({
    registryLoader: () => registry,
    fetchImpl: async () => {
      throw new Error("bridge unavailable");
    },
  });

  const request = {
    label: "Bridge failure test",
    role: "reader",
    prompt: "never forward",
  };
  const result = registry.observeSubagentStatus.call(
    registry,
    { id: "agent-error-test", sessionId: PI_SESSION_ID, state: "running" },
    request,
  );
  assert.equal(result, "upstream-result");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].thisValue, registry);
  assert.equal(calls[0].request, request);
  assert.equal(registry.setSubagentStatusObserver, setter);
  assert.throws(
    () =>
      registry.observeSubagentStatus(
        { id: "agent-error-test", state: "failed", throw: true },
        request,
      ),
    (error) => error === sentinel,
  );
  assert.equal(calls.length, 2);
  await harness.runtime.flush();

  const foreignReplacement = () => "foreign observer";
  registry.observeSubagentStatus = foreignReplacement;
  harness.runtime.stop();
  assert.equal(registry.observeSubagentStatus, foreignReplacement);
  assert.notEqual(originalMethod, foreignReplacement);
});

test("preserves terminal identity and FIFO survivors when a blocked sender reaches its cap", async () => {
  const registry = {
    /** @param {unknown} _status @param {unknown} _request */
    observeSubagentStatus(_status, _request) {},
    setSubagentStatusObserver() {
      assert.fail("the companion must not replace the upstream observer");
    },
  };
  const originalObserver = registry.observeSubagentStatus;
  /** @type {(() => void) | undefined} */
  let releaseBlockedFetch;
  let blockedFetchStarted = false;
  /** @type {HarnessMessage[]} */
  const sent = [];
  const harness = createHarness({
    registryLoader: () => registry,
    fetchImpl: async (_url, options) => {
      if (sent.length === 0) {
        blockedFetchStarted = true;
        /** @type {Promise<void>} */
        const blocked = new Promise((resolve) => {
          releaseBlockedFetch = () => resolve();
        });
        await blocked;
      }
      sent.push(companionMessageSchema.parse(JSON.parse(options.body)));
      return { ok: true, status: 200 };
    },
  });
  while (!blockedFetchStarted) {
    await new Promise((resolve) => setImmediate(resolve));
  }

  const queued = Array.from({ length: 252 }, (_, index) => ({
    sessionId: PI_SESSION_ID,
    runId: `run-${index}`,
    agentId: `agent-${index % 3}`,
    state: "running",
    timestamp: FIXED_TIME + index,
  }));
  for (const status of queued) harness.emitWorkflow(status);
  harness.emitWorkflow({
    ...queued[1],
    state: "paused",
    timestamp: FIXED_TIME + 300,
  });
  registry.observeSubagentStatus(
    {
      id: "agent-1",
      sessionId: PI_SESSION_ID,
      state: "completed",
      finishedAt: FIXED_TIME + 252,
    },
    { label: "Standalone worker" },
  );
  harness.emitWorkflow({
    sessionId: PI_SESSION_ID,
    runId: "terminal-run",
    agentId: "terminal-agent",
    state: "completed",
    timestamp: FIXED_TIME + 253,
  });
  harness.emitWorkflow({
    sessionId: PI_SESSION_ID,
    runId: "terminal-run",
    agentId: "terminal-agent",
    state: "running",
    timestamp: FIXED_TIME + 254,
  });
  harness.emitWorkflow({
    sessionId: PI_SESSION_ID,
    runId: "overflow-run",
    agentId: "overflow-agent",
    state: "running",
    timestamp: FIXED_TIME + 255,
  });

  assert.equal(harness.runtime.active, false);
  assert.equal(harness.hasWorkflowListener, false);
  assert.equal(harness.intervalCleared, true);
  releaseBlockedFetch?.();
  await harness.runtime.flush();

  const updates = sent.filter((message) => message.type === "update");
  assert.equal(updates.length, 254);
  assert.deepEqual(
    updates.map(({ status }) => [
      status.source,
      status.runId,
      status.agentId,
      status.state,
    ]),
    [
      ...queued
        .slice(2)
        .map((status) => [
          "workflow",
          status.runId,
          status.agentId,
          AGENT_STATE.RUNNING,
        ]),
      ["workflow", queued[1]?.runId, queued[1]?.agentId, AGENT_STATE.PAUSED],
      ["standalone", undefined, "agent-1", AGENT_STATE.COMPLETED],
      ["workflow", "terminal-run", "terminal-agent", AGENT_STATE.COMPLETED],
      ["workflow", "overflow-run", "overflow-agent", AGENT_STATE.RUNNING],
    ],
  );
  assert.equal(sent[0]?.type, "hello");
  assert.equal(sent.at(-1)?.type, "unsupported");
  assert.equal(
    sent.at(-1)?.type === "unsupported" && sent.at(-1)?.code,
    UNSUPPORTED_CODE.COMPANION_ERROR,
  );
  assert.equal(registry.observeSubagentStatus, originalObserver);
});

test("reports unsupported observer or event seams and leaves unconfigured installs untouched", async () => {
  const missingRegistry = {};
  const unsupportedRegistry = createHarness({
    registryLoader: () => missingRegistry,
  });
  assert.equal(unsupportedRegistry.runtime.active, false);
  await unsupportedRegistry.runtime.flush();
  assert.deepEqual(unsupportedRegistry.messages, [
    {
      type: "unsupported",
      piSessionId: PI_SESSION_ID,
      code: UNSUPPORTED_CODE.MISSING_REGISTRY_OBSERVER,
    },
  ]);
  assert.deepEqual(missingRegistry, {});

  resetWorkflowRegistry();
  try {
    const registry = loadingRegistry();
    const originalMethod = registry.observeSubagentStatus;
    const missingEvents = createHarness({ pi: { events: undefined } });
    assert.equal(missingEvents.runtime.active, false);
    await missingEvents.runtime.flush();
    assert.equal(registry.observeSubagentStatus, originalMethod);
    assert.equal(missingEvents.messages[0]?.type, "unsupported");
    assert.equal(
      missingEvents.messages[0]?.code,
      UNSUPPORTED_CODE.MISSING_WORKFLOW_EVENTS,
    );

    const disabled = createHarness({ bridgeUrl: "", bridgeToken: "" });
    assert.equal(disabled.runtime.active, false);
    await disabled.runtime.flush();
    assert.deepEqual(disabled.messages, []);
  } finally {
    resetWorkflowRegistry();
  }
});
