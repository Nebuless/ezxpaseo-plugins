import assert from "node:assert/strict";
import test from "node:test";
import {
  applyWatchResponse,
  createPanelState,
  subagentStatusKey,
} from "./panel-state.mjs";

/**
 * @typedef {import("../shared/subagents.ts").WorkflowAgentStatus} WorkflowAgentStatus
 * @typedef {import("../shared/subagents.ts").StandaloneAgentStatus} StandaloneAgentStatus
 * @typedef {import("../shared/subagents.ts").WatchSubagentsOutput} WatchSubagentsOutput
 */

/** @param {Partial<WorkflowAgentStatus>} [overrides] @returns {WorkflowAgentStatus} */
function workflowStatus(overrides = {}) {
  const status = /** @satisfies {WorkflowAgentStatus} */ ({
    piSessionId: "pi-session-a",
    source: "workflow",
    runId: "run-a",
    agentId: "child-1",
    state: "running",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  return Object.assign(status, overrides);
}

/** @param {Partial<StandaloneAgentStatus>} [overrides] @returns {StandaloneAgentStatus} */
function standaloneStatus(overrides = {}) {
  const status = /** @satisfies {StandaloneAgentStatus} */ ({
    piSessionId: "pi-session-a",
    source: "standalone",
    agentId: "child-1",
    state: "running",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  return Object.assign(status, overrides);
}

/** @param {Partial<WatchSubagentsOutput>} [overrides] @returns {WatchSubagentsOutput} */
function response(overrides = {}) {
  const base = /** @satisfies {WatchSubagentsOutput} */ ({
    parentAgentId: "parent-a",
    piSessionId: "pi-session-a",
    availability: "connected",
    cursor: 1,
    gap: false,
    snapshot: null,
    updates: [],
  });
  return Object.assign(base, overrides);
}

test("keeps workflow runs and standalone agents distinct and updates only the matching entry", () => {
  const workflow = workflowStatus();
  const standalone = standaloneStatus();
  const initial = applyWatchResponse(
    createPanelState(),
    response({
      snapshot: { agents: [workflow, standalone], lastHeartbeatAt: null },
    }),
    "parent-a",
  );

  assert.equal(initial.agents.size, 2);
  assert.notEqual(subagentStatusKey(workflow), subagentStatusKey(standalone));

  const completed = workflowStatus({
    state: "completed",
    updatedAt: "2026-01-01T00:00:05.000Z",
  });
  const next = applyWatchResponse(
    initial,
    response({
      cursor: 2,
      updates: [{ cursor: 2, status: completed }],
    }),
    "parent-a",
  );

  assert.equal(next.agents.size, 2);
  assert.equal(
    next.agents.get(subagentStatusKey(completed))?.state,
    "completed",
  );
  assert.equal(
    next.agents.get(subagentStatusKey(standalone))?.state,
    "running",
  );
});

test("ignores a response scoped to another parent", () => {
  const current = applyWatchResponse(
    createPanelState(),
    response({
      snapshot: { agents: [workflowStatus()], lastHeartbeatAt: null },
    }),
    "parent-a",
  );
  const foreign = applyWatchResponse(
    current,
    response({
      parentAgentId: "parent-b",
      snapshot: {
        agents: [workflowStatus({ agentId: "foreign-child" })],
        lastHeartbeatAt: null,
      },
    }),
    "parent-a",
  );

  assert.equal(foreign, current);
  assert.equal(foreign.agents.size, 1);
  assert.equal([...foreign.agents.values()][0].agentId, "child-1");
});

test("replaces old state on a missed-update snapshot and exposes the gap", () => {
  const current = applyWatchResponse(
    createPanelState(),
    response({
      snapshot: { agents: [workflowStatus()], lastHeartbeatAt: null },
    }),
    "parent-a",
  );
  const latest = standaloneStatus({ agentId: "child-2", state: "completed" });
  const recovered = applyWatchResponse(
    current,
    response({
      cursor: 9,
      gap: true,
      snapshot: {
        agents: [latest],
        lastHeartbeatAt: "2026-01-01T00:00:10.000Z",
      },
    }),
    "parent-a",
  );

  assert.equal(recovered.gapDetected, true);
  assert.equal(recovered.agents.size, 1);
  assert.equal(
    recovered.agents.get(subagentStatusKey(latest))?.state,
    "completed",
  );
});

test("does not carry entries into a different Pi session", () => {
  const current = applyWatchResponse(
    createPanelState(),
    response({
      snapshot: { agents: [workflowStatus()], lastHeartbeatAt: null },
    }),
    "parent-a",
  );
  const nextSessionStatus = standaloneStatus({
    piSessionId: "pi-session-b",
    agentId: "child-2",
  });
  const nextSession = applyWatchResponse(
    current,
    response({
      piSessionId: "pi-session-b",
      cursor: 1,
      updates: [{ cursor: 1, status: nextSessionStatus }],
    }),
    "parent-a",
  );

  assert.equal(nextSession.agents.size, 1);
  assert.equal(nextSession.piSessionId, "pi-session-b");
  assert.equal(
    nextSession.agents.has(subagentStatusKey(workflowStatus())),
    false,
  );
});

test("clears old session rows while unavailable and recovers from a replacement snapshot", () => {
  const oldStatus = workflowStatus();
  const current = applyWatchResponse(
    createPanelState(),
    response({
      snapshot: { agents: [oldStatus], lastHeartbeatAt: null },
    }),
    "parent-a",
  );
  const unavailable = applyWatchResponse(
    current,
    response({ piSessionId: null, availability: "unavailable", cursor: 0 }),
    "parent-a",
  );

  assert.equal(unavailable.piSessionId, null);
  assert.equal(unavailable.agents.size, 0);

  const replacementStatus = standaloneStatus({
    piSessionId: "pi-session-b",
    agentId: "replacement-child",
  });
  const replacement = applyWatchResponse(
    unavailable,
    response({
      piSessionId: "pi-session-b",
      cursor: 1,
      snapshot: { agents: [replacementStatus], lastHeartbeatAt: null },
    }),
    "parent-a",
  );

  assert.equal(replacement.piSessionId, "pi-session-b");
  assert.equal(replacement.agents.size, 1);
  assert.equal(replacement.agents.has(subagentStatusKey(oldStatus)), false);
  assert.equal(
    replacement.agents.get(subagentStatusKey(replacementStatus))?.agentId,
    "replacement-child",
  );
});

test("retains a known snapshot for a stale response scoped to the same session", () => {
  const status = workflowStatus();
  const current = applyWatchResponse(
    createPanelState(),
    response({
      snapshot: { agents: [status], lastHeartbeatAt: null },
    }),
    "parent-a",
  );
  const stale = applyWatchResponse(
    current,
    response({ availability: "stale", cursor: 2 }),
    "parent-a",
  );

  assert.equal(stale.piSessionId, "pi-session-a");
  assert.equal(stale.availability, "stale");
  assert.equal(stale.agents.size, 1);
  assert.equal(stale.agents.get(subagentStatusKey(status)), status);
});
