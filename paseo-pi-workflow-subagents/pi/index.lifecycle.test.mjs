import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  loadingRegistry,
  resetWorkflowRegistry,
} from "pi-extensible-workflows/registry";
import {
  PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN_ENV,
  PI_WORKFLOW_SUBAGENTS_BRIDGE_URL_ENV,
} from "../shared/subagent-schema.mjs";
import registerPiWorkflowSubagentCompanion from "./index.ts";

const packageEntry = fileURLToPath(
  import.meta.resolve("pi-extensible-workflows"),
);
const unsupportedEntry = fileURLToPath(import.meta.url);
/** @typedef {{name: string, sourceInfo: {path: string}}} WorkflowTool */
/** @type {WorkflowTool[]} */
const unsupportedTools = [
  { name: "workflow", sourceInfo: { path: unsupportedEntry } },
  { name: "subagents_run", sourceInfo: { path: unsupportedEntry } },
];
/** @type {import("../shared/subagents.js").CompanionMessage[]} */
const bridgeMessages = [];
/** @type {WorkflowTool[]} */
const supportedTools = [
  { name: "workflow", sourceInfo: { path: packageEntry } },
  { name: "subagents_run", sourceInfo: { path: packageEntry } },
];

/** @param {() => Array<{name: string, sourceInfo: {path: string}}>} getAllTools */
function createHarness(getAllTools) {
  /** @type {Map<string, (...args: any[]) => any>} */
  const handlers = new Map();
  /** @type {((event: unknown) => void) | undefined} */
  let workflowListener;
  const pi = {
    getAllTools,
    /** @param {string} event @param {(...args: any[]) => any} handler */
    on(event, handler) {
      handlers.set(event, handler);
    },
    events: {
      /** @param {string} _event @param {(event: unknown) => void} handler */
      on(_event, handler) {
        workflowListener = handler;
        return () => {
          workflowListener = undefined;
        };
      },
    },
  };
  registerPiWorkflowSubagentCompanion(/** @type {any} */ (pi));
  return {
    handlers,
    /** @param {unknown[]} args */
    start(...args) {
      const handler = handlers.get("session_start");
      if (!handler) throw new Error("session_start handler was not registered");
      return handler(...args);
    },
    get hasWorkflowListener() {
      return typeof workflowListener === "function";
    },
    shutdown() {
      handlers.get("session_shutdown")?.();
    },
  };
}

/** @param {import("node:test").TestContext} t */
function setupRuntime(t) {
  const previousUrl = process.env[PI_WORKFLOW_SUBAGENTS_BRIDGE_URL_ENV];
  const previousToken = process.env[PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN_ENV];
  const previousFetch = globalThis.fetch;
  const previousSetInterval = globalThis.setInterval;
  const previousClearInterval = globalThis.clearInterval;
  const runtimeGlobals = /** @type {any} */ (globalThis);
  process.env[PI_WORKFLOW_SUBAGENTS_BRIDGE_URL_ENV] = "http://127.0.0.1:3210";
  process.env[PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN_ENV] = "lifecycle-test-token";
  bridgeMessages.length = 0;
  runtimeGlobals.fetch =
    /** @param {string} _url @param {{body: string}} request */ async (
      _url,
      request,
    ) => {
      bridgeMessages.push(JSON.parse(request.body));
      return { ok: true, status: 200 };
    };
  /** @type {Array<{callback: () => void, delay: number}>} */
  const intervals = [];
  let clearedIntervals = 0;
  runtimeGlobals.setInterval =
    /** @param {() => void} callback @param {number} delay */ (
      callback,
      delay,
    ) => {
      intervals.push({ callback, delay });
      return intervals.length;
    };
  runtimeGlobals.clearInterval = () => {
    clearedIntervals += 1;
  };
  resetWorkflowRegistry();
  const registry = loadingRegistry();
  const originalObserver = registry.observeSubagentStatus;
  t.after(() => {
    if (registry.observeSubagentStatus !== originalObserver) {
      registry.observeSubagentStatus = originalObserver;
    }
    resetWorkflowRegistry();
    if (previousUrl === undefined) {
      delete process.env[PI_WORKFLOW_SUBAGENTS_BRIDGE_URL_ENV];
    } else {
      process.env[PI_WORKFLOW_SUBAGENTS_BRIDGE_URL_ENV] = previousUrl;
    }
    if (previousToken === undefined) {
      delete process.env[PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN_ENV];
    } else {
      process.env[PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN_ENV] = previousToken;
    }
    runtimeGlobals.fetch = previousFetch;
    runtimeGlobals.setInterval = previousSetInterval;
    runtimeGlobals.clearInterval = previousClearInterval;
  });
  return {
    intervals,
    get clearedIntervals() {
      return clearedIntervals;
    },
    registry,
    originalObserver,
  };
}

const context = {
  sessionManager: { getSessionId: () => "pi-lifecycle-session" },
};

test("newer session start invalidates an older unsupported probe", async (t) => {
  const runtime = setupRuntime(t);
  let probeCount = 0;
  const harness = createHarness(() =>
    probeCount++ === 0 ? unsupportedTools : supportedTools,
  );
  const staleStart = harness.start({}, context);
  const currentStart = harness.start({}, context);
  await Promise.all([staleStart, currentStart]);

  assert.equal(
    bridgeMessages.some((message) => message.type === "unsupported"),
    false,
  );
  assert.equal(
    bridgeMessages.filter((message) => message.type === "hello").length,
    1,
  );
  assert.equal(harness.hasWorkflowListener, true);
  assert.notEqual(
    runtime.registry.observeSubagentStatus,
    runtime.originalObserver,
  );

  harness.shutdown();
  assert.equal(harness.hasWorkflowListener, false);
  assert.equal(runtime.intervals.length, 1);
  assert.equal(runtime.clearedIntervals, 1);
  assert.equal(
    runtime.registry.observeSubagentStatus,
    runtime.originalObserver,
  );
  runtime.intervals[0]?.callback();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    bridgeMessages.some((message) => message.type === "heartbeat"),
    false,
  );
});

test("newer session start aborts a superseded unsupported report", async (t) => {
  setupRuntime(t);
  let probeCount = 0;
  const harness = createHarness(() =>
    probeCount++ === 0 ? unsupportedTools : supportedTools,
  );
  let unsupportedRequestStarted = () => {};
  /** @type {Promise<void>} */
  const unsupportedStarted = new Promise((resolve) => {
    unsupportedRequestStarted = () => resolve();
  });
  let unsupportedRequestAborted = false;
  const runtimeGlobals = /** @type {any} */ (globalThis);
  runtimeGlobals.fetch =
    /** @param {string} _url @param {{body: string, signal: AbortSignal}} request */ async (
      _url,
      request,
    ) => {
      const message = JSON.parse(request.body);
      if (message.type === "unsupported") {
        return new Promise((resolve) => {
          request.signal.addEventListener(
            "abort",
            () => {
              unsupportedRequestAborted = true;
              resolve({ ok: false, status: 500 });
            },
            { once: true },
          );
          unsupportedRequestStarted();
        });
      }
      bridgeMessages.push(message);
      return { ok: true, status: 200 };
    };

  const staleStart = harness.start({}, context);
  await unsupportedStarted;
  const currentStart = harness.start({}, context);
  await Promise.all([staleStart, currentStart]);

  assert.equal(unsupportedRequestAborted, true);
  assert.equal(
    bridgeMessages.some((message) => message.type === "unsupported"),
    false,
  );
  assert.equal(
    bridgeMessages.filter((message) => message.type === "hello").length,
    1,
  );
  harness.shutdown();
});

test("shutdown aborts an unsupported report after its support probe", async (t) => {
  const runtime = setupRuntime(t);
  const harness = createHarness(() => unsupportedTools);
  /** @type {(() => void) | undefined} */
  let fetchStarted;
  /** @type {Promise<void>} */
  const started = new Promise((resolve) => {
    fetchStarted = () => resolve();
  });
  let aborted = false;
  const runtimeGlobals = /** @type {any} */ (globalThis);
  runtimeGlobals.fetch =
    /** @param {string} _url @param {{signal: AbortSignal}} request */ async (
      _url,
      request,
    ) =>
      new Promise((resolve) => {
        request.signal.addEventListener(
          "abort",
          () => {
            aborted = request.signal.aborted;
            resolve({ ok: false, status: 500 });
          },
          { once: true },
        );
        fetchStarted?.();
      });
  const starting = harness.start({}, context);
  await started;
  harness.shutdown();
  await starting;

  assert.equal(aborted, true);
  assert.equal(harness.hasWorkflowListener, false);
  assert.equal(runtime.intervals.length, 0);
});

test("shutdown invalidates a supported probe before observer installation", async (t) => {
  const runtime = setupRuntime(t);
  const harness = createHarness(() => supportedTools);
  const starting = harness.start({}, context);
  harness.shutdown();
  await starting;

  assert.deepEqual(bridgeMessages, []);
  assert.equal(harness.hasWorkflowListener, false);
  assert.equal(runtime.intervals.length, 0);
  assert.equal(
    runtime.registry.observeSubagentStatus,
    runtime.originalObserver,
  );
});
