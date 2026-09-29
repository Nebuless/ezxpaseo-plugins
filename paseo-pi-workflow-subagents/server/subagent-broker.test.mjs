import assert from "node:assert/strict";
import test from "node:test";
import { MAX_BRIDGE_BODY_BYTES, SubagentBroker } from "./subagent-broker.ts";
import { MAX_AGENT_COUNT } from "../shared/subagents.ts";

/** @param {string[]} tokens */
function tokenSequence(tokens) {
  let index = 0;
  return () => tokens[index++];
}

/** @param {{createToken?: () => string, statusBufferLength?: number, watchTimeoutMs?: number, staleTimeoutMs?: number, maxWatchersPerSession?: number}} [options] */
async function createStartedBroker(options = {}) {
  const broker = new SubagentBroker(options);
  broker.start();
  return { broker, url: await broker.getUrl() };
}

/** @param {string} url @param {string} token @param {object} message */
async function postMessage(url, token, message) {
  return fetch(`${url}/status`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(message),
  });
}

/** @param {string} piSessionId */
function hello(piSessionId) {
  return { type: "hello", piSessionId, protocolVersion: 1 };
}

/** @param {string} piSessionId @param {string} state @param {string} updatedAt @param {string} [agentId] */
function statusMessage(piSessionId, state, updatedAt, agentId = "sub-agent") {
  return {
    type: "update",
    piSessionId,
    status: {
      piSessionId,
      source: "standalone",
      agentId,
      state,
      updatedAt,
    },
  };
}

test("scopes resume credentials to the same Pi session and preserves its snapshot", async (t) => {
  const { broker, url } = await createStartedBroker({
    createToken: tokenSequence(["create-token", "resume-token"]),
  });
  t.after(() => broker.close());

  const createToken = broker.registerAgent("parent-a");
  assert.equal(
    (await postMessage(url, createToken, hello("pi-session-a"))).status,
    202,
  );
  assert.equal(
    (
      await postMessage(
        url,
        createToken,
        statusMessage("pi-session-a", "running", "2026-09-28T12:00:00.000Z"),
      )
    ).status,
    202,
  );

  const resumeToken = broker.registerAgent("parent-a");
  assert.notEqual(resumeToken, createToken);
  assert.equal(
    (await postMessage(url, createToken, hello("pi-session-a"))).status,
    401,
  );
  assert.equal(
    (await postMessage(url, resumeToken, hello("pi-session-a"))).status,
    202,
  );

  const reopened = await broker.watch({ parentAgentId: "parent-a" });
  assert.equal(reopened.availability, "connected");
  assert.equal(reopened.piSessionId, "pi-session-a");
  assert.ok(reopened.snapshot);
  assert.equal(reopened.snapshot.agents[0].state, "running");
  assert.equal(reopened.cursor, 1);
});

test("isolates parent snapshots when both Pi sessions use the same sub-agent ID", async (t) => {
  const { broker, url } = await createStartedBroker({
    createToken: tokenSequence(["parent-a-token", "parent-b-token"]),
  });
  t.after(() => broker.close());

  const tokenA = broker.registerAgent("parent-a");
  const tokenB = broker.registerAgent("parent-b");
  await postMessage(url, tokenA, hello("pi-session-a"));
  await postMessage(url, tokenB, hello("pi-session-b"));
  await postMessage(
    url,
    tokenA,
    statusMessage(
      "pi-session-a",
      "running",
      "2026-09-28T12:00:00.000Z",
      "shared-id",
    ),
  );
  await postMessage(
    url,
    tokenB,
    statusMessage(
      "pi-session-b",
      "completed",
      "2026-09-28T12:01:00.000Z",
      "shared-id",
    ),
  );

  const snapshotA = await broker.watch({ parentAgentId: "parent-a" });
  const snapshotB = await broker.watch({ parentAgentId: "parent-b" });
  assert.ok(snapshotA.snapshot);
  assert.ok(snapshotB.snapshot);
  assert.deepEqual(
    snapshotA.snapshot.agents.map(({ state }) => state),
    ["running"],
  );
  assert.deepEqual(
    snapshotB.snapshot.agents.map(({ state }) => state),
    ["completed"],
  );
  assert.equal(snapshotA.piSessionId, "pi-session-a");
  assert.equal(snapshotB.piSessionId, "pi-session-b");
});

test("wakes watches on updates, returns latest reopen snapshots, and reports cursor gaps", async (t) => {
  const { broker, url } = await createStartedBroker({
    createToken: tokenSequence(["watch-token"]),
    statusBufferLength: 2,
    watchTimeoutMs: 500,
  });
  t.after(() => broker.close());

  const token = broker.registerAgent("parent-a");
  await postMessage(url, token, hello("pi-session-a"));
  const startedAt = Date.now();
  const pendingWatch = broker.watch({
    parentAgentId: "parent-a",
    piSessionId: "pi-session-a",
    cursor: 0,
  });
  await postMessage(
    url,
    token,
    statusMessage("pi-session-a", "running", "2026-09-28T12:00:00.000Z"),
  );
  const firstUpdate = await pendingWatch;
  assert.ok(
    Date.now() - startedAt < 400,
    "watch should wake before its timeout",
  );
  assert.equal(firstUpdate.snapshot, null);
  assert.deepEqual(
    firstUpdate.updates.map(({ cursor }) => cursor),
    [1],
  );

  await postMessage(
    url,
    token,
    statusMessage("pi-session-a", "pending", "2026-09-28T12:00:01.000Z"),
  );
  await postMessage(
    url,
    token,
    statusMessage("pi-session-a", "completed", "2026-09-28T12:00:02.000Z"),
  );
  const gap = await broker.watch({
    parentAgentId: "parent-a",
    piSessionId: "pi-session-a",
    cursor: 0,
  });
  assert.equal(gap.gap, true);
  assert.equal(gap.cursor, 3);
  assert.deepEqual(gap.updates, []);
  assert.ok(gap.snapshot);
  assert.equal(gap.snapshot.agents[0].state, "completed");

  const reopened = await broker.watch({ parentAgentId: "parent-a" });
  assert.equal(reopened.gap, false);
  assert.ok(reopened.snapshot);
  assert.equal(reopened.snapshot.agents[0].state, "completed");
});

test("times out idle watches and follows a resumed parent session with a fresh snapshot", async (t) => {
  const { broker, url } = await createStartedBroker({
    createToken: tokenSequence(["old-token", "new-token"]),
    watchTimeoutMs: 20,
    staleTimeoutMs: 1_000,
  });
  t.after(() => broker.close());

  const firstToken = broker.registerAgent("parent-a");
  await postMessage(url, firstToken, hello("pi-session-old"));
  await postMessage(
    url,
    firstToken,
    statusMessage(
      "pi-session-old",
      "running",
      "2026-09-28T12:00:00.000Z",
      "old-agent",
    ),
  );
  const timedOut = await broker.watch({
    parentAgentId: "parent-a",
    piSessionId: "pi-session-old",
    cursor: 1,
  });
  assert.equal(timedOut.snapshot, null);
  assert.deepEqual(timedOut.updates, []);

  const secondToken = broker.registerAgent("parent-a");
  const pendingResume = await broker.watch({
    parentAgentId: "parent-a",
    piSessionId: "pi-session-old",
    cursor: 1,
  });
  assert.equal(pendingResume.availability, "unavailable");
  assert.equal(pendingResume.piSessionId, null);
  await postMessage(url, secondToken, hello("pi-session-new"));
  await postMessage(
    url,
    secondToken,
    statusMessage(
      "pi-session-new",
      "completed",
      "2026-09-28T12:01:00.000Z",
      "new-agent",
    ),
  );
  const followed = await broker.watch({
    parentAgentId: "parent-a",
    piSessionId: "pi-session-old",
    cursor: 1,
  });
  assert.equal(followed.piSessionId, "pi-session-new");
  assert.equal(followed.cursor, 1);
  assert.ok(followed.snapshot);
  assert.equal(followed.snapshot.agents[0].agentId, "new-agent");
  assert.deepEqual(followed.updates, []);
});

test("reports unsupported and stale bridge availability through snapshots", async (t) => {
  const { broker, url } = await createStartedBroker({
    createToken: tokenSequence(["unsupported-token"]),
    watchTimeoutMs: 500,
    staleTimeoutMs: 30,
  });
  t.after(() => broker.close());

  const token = broker.registerAgent("parent-a");
  assert.equal(
    (
      await postMessage(url, token, {
        type: "unsupported",
        piSessionId: "pi-session-a",
        code: "missing-registry-observer",
      })
    ).status,
    202,
  );
  const unsupported = await broker.watch({ parentAgentId: "parent-a" });
  assert.equal(unsupported.availability, "unsupported");

  const pending = broker.watch({
    parentAgentId: "parent-a",
    piSessionId: "pi-session-a",
    cursor: 0,
  });
  const stale = await pending;
  assert.equal(stale.availability, "stale");
  assert.notEqual(stale.snapshot, null);
});

test("rejects watches over the per-session watcher limit", async (t) => {
  const { broker, url } = await createStartedBroker({
    createToken: tokenSequence(["watch-cap-token"]),
    maxWatchersPerSession: 1,
  });
  t.after(() => broker.close());

  const token = broker.registerAgent("parent-a");
  await postMessage(url, token, hello("pi-session-a"));
  const pendingWatch = broker.watch({
    parentAgentId: "parent-a",
    piSessionId: "pi-session-a",
    cursor: 0,
  });

  await assert.rejects(
    broker.watch({
      parentAgentId: "parent-a",
      piSessionId: "pi-session-a",
      cursor: 0,
    }),
    /session.*watcher limit/i,
  );

  assert.equal(
    (
      await postMessage(
        url,
        token,
        statusMessage("pi-session-a", "running", "2026-09-28T12:00:00.000Z"),
      )
    ).status,
    202,
  );
  const delivered = await pendingWatch;
  assert.deepEqual(
    delivered.updates.map(({ cursor }) => cursor),
    [1],
  );
});

test("rejects watches over the pending-parent watcher limit", async (t) => {
  const { broker, url } = await createStartedBroker({
    createToken: tokenSequence(["parent-watch-cap-token"]),
  });
  t.after(() => broker.close());

  const token = broker.registerAgent("parent-a");
  const pendingWatches = Array.from({ length: 64 }, () =>
    broker.watch({ parentAgentId: "parent-a", cursor: 0 }),
  );

  await assert.rejects(
    broker.watch({ parentAgentId: "parent-a", cursor: 0 }),
    /parent.*watcher limit/i,
  );

  assert.equal(
    (await postMessage(url, token, hello("pi-session-a"))).status,
    202,
  );
  const delivered = await Promise.all(pendingWatches);
  assert.equal(delivered.length, 64);
  assert.ok(delivered.every(({ snapshot }) => snapshot !== null));
});

test("rejecting a new agent at capacity does not reconnect a stale session, while heartbeat does", async (t) => {
  const watchTimeoutMs = 500;
  const staleTimeoutMs = 100;
  const { broker, url } = await createStartedBroker({
    createToken: tokenSequence(["agent-cap-token"]),
    watchTimeoutMs,
    staleTimeoutMs,
  });
  t.after(() => broker.close());

  const token = broker.registerAgent("parent-a");
  assert.equal(
    (await postMessage(url, token, hello("pi-session-a"))).status,
    202,
  );
  for (let index = 0; index < MAX_AGENT_COUNT; index += 1) {
    const response = await postMessage(
      url,
      token,
      statusMessage(
        "pi-session-a",
        "running",
        "2026-09-28T12:00:00.000Z",
        "agent-" + index,
      ),
    );
    assert.equal(response.status, 202);
  }

  await new Promise((resolve) => setTimeout(resolve, staleTimeoutMs * 2));
  const stale = await broker.watch({ parentAgentId: "parent-a" });
  assert.equal(stale.availability, "stale");
  assert.ok(stale.snapshot);
  const lastHeartbeatAt = stale.snapshot.lastHeartbeatAt;

  const waitingForChange = broker.watch({
    parentAgentId: "parent-a",
    piSessionId: "pi-session-a",
    cursor: stale.cursor,
  });
  const rejected = await postMessage(
    url,
    token,
    statusMessage(
      "pi-session-a",
      "running",
      "2026-09-28T12:01:00.000Z",
      "over-cap-agent",
    ),
  );
  assert.equal(rejected.status, 429);
  const rejection = await rejected.json();
  assert.ok(rejection && typeof rejection === "object" && "error" in rejection);
  assert.equal(typeof rejection.error, "string");
  assert.match(String(rejection.error), /agent limit/i);

  const afterRejection = await broker.watch({ parentAgentId: "parent-a" });
  assert.equal(afterRejection.availability, "stale");
  assert.equal(afterRejection.snapshot?.lastHeartbeatAt, lastHeartbeatAt);
  assert.equal((await waitingForChange).availability, "stale");

  const heartbeatWatch = broker.watch({
    parentAgentId: "parent-a",
    piSessionId: "pi-session-a",
    cursor: stale.cursor,
  });
  const heartbeatStartedAt = Date.now();
  assert.equal(
    (
      await postMessage(url, token, {
        type: "heartbeat",
        piSessionId: "pi-session-a",
      })
    ).status,
    202,
  );
  const reconnected = await heartbeatWatch;
  assert.ok(Date.now() - heartbeatStartedAt < 400);
  assert.equal(reconnected.availability, "connected");
  assert.ok(reconnected.snapshot);
});

test("rejects invalid credentials, non-POST requests, and oversized bridge bodies", async (t) => {
  const { broker, url } = await createStartedBroker({
    createToken: tokenSequence(["valid-token"]),
  });
  t.after(() => broker.close());
  const token = broker.registerAgent("parent-a");

  const method = await fetch(`${url}/status`, { method: "GET" });
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("allow"), "POST");

  const invalidToken = await postMessage(
    url,
    "wrong-token",
    hello("pi-session-a"),
  );
  assert.equal(invalidToken.status, 401);

  const oversized = await fetch(`${url}/status`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: "x".repeat(MAX_BRIDGE_BODY_BYTES + 1),
  });
  assert.equal(oversized.status, 413);
  assert.equal(
    (await broker.watch({ parentAgentId: "parent-a" })).availability,
    "unavailable",
  );
});
