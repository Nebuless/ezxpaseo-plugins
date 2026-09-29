import assert from "node:assert/strict";
import test from "node:test";
import contribute from "../index.server.ts";
import {
  PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN_ENV,
  PI_WORKFLOW_SUBAGENTS_BRIDGE_URL_ENV,
  watchWorkflowSubagentsRpc,
} from "../shared/subagents.ts";

function createPluginHarness() {
  const beforeHooks = new Map();
  const eventHooks = new Map();
  const rpcHandlers = new Map();
  const server = /** @type {any} */ ({
    before(/** @type {string} */ name, /** @type {Function} */ handler) {
      beforeHooks.set(name, handler);
      return () => beforeHooks.delete(name);
    },
    on(/** @type {string} */ name, /** @type {Function} */ handler) {
      eventHooks.set(name, handler);
      return () => eventHooks.delete(name);
    },
    handle(
      /** @type {{name: string}} */ contract,
      /** @type {Function} */ handler,
    ) {
      rpcHandlers.set(contract.name, handler);
    },
  });
  return { server, beforeHooks, eventHooks, rpcHandlers };
}

function sessionRequest({
  agentId = "parent-a",
  provider = "pi",
  purpose = "interactive",
  reason = "create",
} = {}) {
  return {
    agentId,
    provider,
    purpose,
    reason,
    workspaceId: "workspace-a",
    cwd: "/tmp/project",
    env: { EXISTING_ENV: "preserved" },
  };
}

/** @param {string} url @param {string} token @param {object} message */
async function postStatus(url, token, message) {
  return fetch(`${url}/status`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(message),
  });
}

test("injects bridge credentials only into interactive Pi create and resume sessions", async (t) => {
  const { server, beforeHooks, rpcHandlers } = createPluginHarness();
  let timelineAppends = 0;
  const cleanup = contribute(server);
  t.after(() => cleanup());
  const hook = beforeHooks.get("agent.session_open");
  const context = {
    paseo: {
      agents: {
        ref() {
          return {
            timeline: {
              append() {
                timelineAppends += 1;
              },
            },
          };
        },
      },
    },
    signal: new AbortController().signal,
  };

  const unrelated = sessionRequest({ provider: "codex" });
  const history = sessionRequest({ purpose: "history" });
  assert.strictEqual(await hook({ request: unrelated }, context), unrelated);
  assert.strictEqual(await hook({ request: history }, context), history);

  const created = await hook({ request: sessionRequest() }, context);
  const bridgeUrl = created.env[PI_WORKFLOW_SUBAGENTS_BRIDGE_URL_ENV];
  const createToken = created.env[PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN_ENV];
  assert.equal(created.env.EXISTING_ENV, "preserved");
  assert.equal(new URL(bridgeUrl).hostname, "127.0.0.1");
  assert.ok(createToken.length >= 32);

  assert.equal(
    (
      await postStatus(bridgeUrl, createToken, {
        type: "hello",
        piSessionId: "pi-session-a",
        protocolVersion: 1,
      })
    ).status,
    202,
  );
  assert.equal(
    (
      await postStatus(bridgeUrl, createToken, {
        type: "update",
        piSessionId: "pi-session-a",
        status: {
          piSessionId: "pi-session-a",
          source: "standalone",
          agentId: "sub-agent-a",
          state: "running",
          updatedAt: "2026-09-28T12:00:00.000Z",
        },
      })
    ).status,
    202,
  );

  const resumed = await hook(
    { request: sessionRequest({ reason: "resume" }) },
    context,
  );
  const resumeToken = resumed.env[PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN_ENV];
  assert.notEqual(resumeToken, createToken);
  assert.equal(
    (
      await postStatus(bridgeUrl, createToken, {
        type: "heartbeat",
        piSessionId: "pi-session-a",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await postStatus(bridgeUrl, resumeToken, {
        type: "hello",
        piSessionId: "pi-session-a",
        protocolVersion: 1,
      })
    ).status,
    202,
  );

  const watch = rpcHandlers.get(watchWorkflowSubagentsRpc.name);
  const snapshot = await watch(
    { parentAgentId: "parent-a" },
    { paseo: context.paseo },
  );
  assert.equal(snapshot.availability, "connected");
  assert.equal(snapshot.snapshot.agents[0].agentId, "sub-agent-a");
  assert.equal(timelineAppends, 0);
});

test("archive removes the parent's receiver token and snapshot state", async (t) => {
  const { server, beforeHooks, eventHooks, rpcHandlers } =
    createPluginHarness();
  const cleanup = contribute(server);
  t.after(() => cleanup());
  const context = { paseo: {}, signal: new AbortController().signal };
  const opened = await beforeHooks.get("agent.session_open")(
    { request: sessionRequest() },
    context,
  );
  const bridgeUrl = opened.env[PI_WORKFLOW_SUBAGENTS_BRIDGE_URL_ENV];
  const token = opened.env[PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN_ENV];
  await postStatus(bridgeUrl, token, {
    type: "hello",
    piSessionId: "pi-session-a",
    protocolVersion: 1,
  });
  await postStatus(bridgeUrl, token, {
    type: "update",
    piSessionId: "pi-session-a",
    status: {
      piSessionId: "pi-session-a",
      source: "standalone",
      agentId: "sub-agent-a",
      state: "running",
      updatedAt: "2026-09-28T12:00:00.000Z",
    },
  });

  eventHooks.get("agent.archived")(
    { agent: { id: "parent-a" }, archivedAt: "2026-09-28T12:01:00.000Z" },
    context,
  );
  assert.equal(
    (
      await postStatus(bridgeUrl, token, {
        type: "heartbeat",
        piSessionId: "pi-session-a",
      })
    ).status,
    401,
  );
  const watch = rpcHandlers.get(watchWorkflowSubagentsRpc.name);
  const result = await watch(
    { parentAgentId: "parent-a" },
    { paseo: context.paseo },
  );
  assert.equal(result.availability, "unavailable");
  assert.equal(result.piSessionId, null);
  assert.equal(result.snapshot, null);
});
