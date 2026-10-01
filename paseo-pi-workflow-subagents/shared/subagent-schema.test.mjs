import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_SOURCE,
  AGENT_STATE,
  MAX_AGENT_ATTEMPT,
  MAX_LABEL_LENGTH,
  MONITORING_AVAILABILITY,
  PI_WORKFLOW_SUBAGENTS_PROTOCOL_VERSION,
  TOOL_STATE,
  UNSUPPORTED_CODE,
  agentStatusSchema,
  companionMessageSchema,
  watchSubagentsInputSchema,
  watchSubagentsOutputSchema,
} from "./subagent-schema.mjs";

const timestamp = "2026-09-28T12:00:00.000Z";
const workflowStatus = {
  piSessionId: "pi-session_1",
  source: AGENT_SOURCE.WORKFLOW,
  runId: "run_1",
  agentId: "agent_1",
  label: "Review agent",
  role: "reviewer",
  state: AGENT_STATE.RUNNING,
  updatedAt: timestamp,
};
const standaloneStatus = {
  piSessionId: "pi-session_1",
  source: AGENT_SOURCE.STANDALONE,
  agentId: "standalone_1",
  label: "Test agent",
  state: AGENT_STATE.RUNNING,
  toolName: "shell.exec",
  toolState: TOOL_STATE.RUNNING,
  updatedAt: timestamp,
};

test("status schemas accept workflow and standalone transitions distinctly", () => {
  assert.deepEqual(agentStatusSchema.parse(workflowStatus), workflowStatus);
  assert.deepEqual(agentStatusSchema.parse(standaloneStatus), standaloneStatus);

  const workflowCompletion = {
    ...workflowStatus,
    state: AGENT_STATE.COMPLETED,
    updatedAt: "2026-09-28T12:00:01.000Z",
  };
  const standaloneCompletion = {
    ...standaloneStatus,
    state: AGENT_STATE.COMPLETED,
    toolState: TOOL_STATE.COMPLETED,
    updatedAt: "2026-09-28T12:00:02.000Z",
  };
  assert.equal(agentStatusSchema.parse(workflowCompletion).state, "completed");
  assert.equal(
    agentStatusSchema.parse(standaloneCompletion).state,
    "completed",
  );
});

test("workflow lifecycle states preserve bounded attempt counts", () => {
  const waiting = {
    ...workflowStatus,
    state: AGENT_STATE.WAITING_FOR_CHILD,
    attempt: MAX_AGENT_ATTEMPT,
  };
  const retrying = {
    ...workflowStatus,
    state: AGENT_STATE.RETRYING,
    attempt: 2,
  };

  assert.equal(
    agentStatusSchema.parse(waiting).state,
    AGENT_STATE.WAITING_FOR_CHILD,
  );
  assert.equal(agentStatusSchema.parse(retrying).attempt, 2);
  for (const state of [AGENT_STATE.QUEUED, AGENT_STATE.PAUSED]) {
    assert.equal(
      agentStatusSchema.parse({ ...workflowStatus, state }).state,
      state,
    );
  }
  for (const attempt of [-1, 1.5, MAX_AGENT_ATTEMPT + 1]) {
    assert.throws(() =>
      agentStatusSchema.parse({ ...workflowStatus, attempt }),
    );
  }
});

test("companion message schema accepts each allowlisted message", () => {
  assert.deepEqual(
    companionMessageSchema.parse({
      type: "hello",
      piSessionId: "pi-session_1",
      protocolVersion: PI_WORKFLOW_SUBAGENTS_PROTOCOL_VERSION,
    }),
    {
      type: "hello",
      piSessionId: "pi-session_1",
      protocolVersion: PI_WORKFLOW_SUBAGENTS_PROTOCOL_VERSION,
    },
  );
  assert.equal(
    companionMessageSchema.parse({
      type: "heartbeat",
      piSessionId: "pi-session_1",
    }).type,
    "heartbeat",
  );
  const updateMessage = companionMessageSchema.parse({
    type: "update",
    piSessionId: "pi-session_1",
    status: workflowStatus,
  });
  if (updateMessage.type !== "update") {
    throw new Error("Expected an update message.");
  }
  assert.equal(updateMessage.status.source, AGENT_SOURCE.WORKFLOW);
  assert.throws(() =>
    companionMessageSchema.parse({
      type: "update",
      piSessionId: "other-session",
      status: workflowStatus,
    }),
  );

  const unsupportedMessage = companionMessageSchema.parse({
    type: "unsupported",
    piSessionId: "pi-session_1",
    code: UNSUPPORTED_CODE.UNSUPPORTED_WORKFLOW_VERSION,
  });
  if (unsupportedMessage.type !== "unsupported") {
    throw new Error("Expected an unsupported message.");
  }
  assert.equal(
    unsupportedMessage.code,
    UNSUPPORTED_CODE.UNSUPPORTED_WORKFLOW_VERSION,
  );
});

test("strict status objects reject prompts, activity text, and free-form errors", () => {
  for (const sensitiveField of ["prompt", "activityText", "errorMessage"]) {
    assert.throws(() =>
      agentStatusSchema.parse({
        ...workflowStatus,
        [sensitiveField]: "private",
      }),
    );
    assert.throws(() =>
      companionMessageSchema.parse({
        type: "update",
        piSessionId: "pi-session_1",
        status: { ...standaloneStatus, [sensitiveField]: "private" },
      }),
    );
  }
  assert.throws(() =>
    companionMessageSchema.parse({
      type: "update",
      piSessionId: "pi-session_1",
      status: workflowStatus,
      prompt: "private",
    }),
  );
});

test("identifiers and display fields are bounded and safe", () => {
  assert.throws(() =>
    agentStatusSchema.parse({ ...workflowStatus, agentId: "" }),
  );
  assert.throws(() =>
    agentStatusSchema.parse({ ...workflowStatus, runId: "bad/id" }),
  );
  assert.throws(() =>
    agentStatusSchema.parse({
      ...workflowStatus,
      piSessionId: "s".repeat(129),
    }),
  );
  assert.throws(() =>
    agentStatusSchema.parse({
      ...workflowStatus,
      label: "x".repeat(MAX_LABEL_LENGTH + 1),
    }),
  );
  assert.throws(() =>
    agentStatusSchema.parse({ ...workflowStatus, role: "\nreviewer" }),
  );
  assert.throws(() =>
    agentStatusSchema.parse({ ...standaloneStatus, toolName: "tool name" }),
  );
  assert.throws(() =>
    agentStatusSchema.parse({
      ...workflowStatus,
      state: "running with prompt text",
    }),
  );
});

test("watch input is strict and cursor-bound", () => {
  assert.deepEqual(
    watchSubagentsInputSchema.parse({
      parentAgentId: "parent_1",
      piSessionId: "pi-session_1",
      cursor: 7,
    }),
    { parentAgentId: "parent_1", piSessionId: "pi-session_1", cursor: 7 },
  );
  assert.throws(() =>
    watchSubagentsInputSchema.parse({ parentAgentId: "../other" }),
  );
  assert.throws(() =>
    watchSubagentsInputSchema.parse({ parentAgentId: "parent_1", cursor: -1 }),
  );
  assert.throws(() =>
    watchSubagentsInputSchema.parse({
      parentAgentId: "parent_1",
      token: "secret",
    }),
  );
});

test("watch output carries availability and marks gaps with a current snapshot", () => {
  const result = {
    parentAgentId: "parent_1",
    piSessionId: "pi-session_1",
    availability: MONITORING_AVAILABILITY.STALE,
    cursor: 10,
    gap: true,
    snapshot: {
      agents: [workflowStatus, standaloneStatus],
      lastHeartbeatAt: timestamp,
    },
    updates: [],
  };
  assert.deepEqual(watchSubagentsOutputSchema.parse(result), result);

  assert.throws(() =>
    watchSubagentsOutputSchema.parse({ ...result, snapshot: null }),
  );
  assert.throws(() =>
    watchSubagentsOutputSchema.parse({
      ...result,
      snapshot: {
        ...result.snapshot,
        agents: [{ ...workflowStatus, piSessionId: "other" }],
      },
    }),
  );
});
