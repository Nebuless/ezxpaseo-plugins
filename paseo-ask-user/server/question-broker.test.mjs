import assert from "node:assert/strict";
import test from "node:test";
import { QuestionBroker } from "./question-broker.ts";

const question = {
  id: "scope",
  prompt: "Which scope should we use?",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  selectionMode: "single",
  recommendationIndex: 0,
};

test("publishes a question and returns the submitted answer", async () => {
  /** @type {Array<{ state: string }>} */
  const published = [];
  const broker = new QuestionBroker({
    createRequestId: () => "request-1",
    createToken: () => "token-1",
    scheduleTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
    cancelTimeout: (handle) => clearTimeout(handle),
    timeoutMs: 1_000,
  });
  broker.start();
  const token = broker.issueToken();
  broker.registerAgent("agent-1", token, async (timelineData) => {
    published.push(timelineData);
  });
  const responsePromise = fetch(`${await broker.getUrl()}/ask`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ questions: [question] }),
  });
  while (published.length === 0) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  await broker.answer({
    agentId: "agent-1",
    requestId: "request-1",
    answers: [{ questionId: "scope", kind: "selection", values: ["small"] }],
  });
  const response = await responsePromise;
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    requestId: "request-1",
    answers: [{ questionId: "scope", kind: "selection", values: ["small"] }],
  });
  assert.deepEqual(
    published.map(({ state }) => state),
    ["pending", "answered"],
  );
  await broker.close();
});

test("rejects an invalid broker token", async () => {
  const broker = new QuestionBroker();
  broker.start();
  const response = await fetch(`${await broker.getUrl()}/ask`, {
    method: "POST",
    headers: {
      authorization: "Bearer invalid",
      "content-type": "application/json",
    },
    body: JSON.stringify({ questions: [question] }),
  });
  assert.equal(response.status, 400);
  assert.match(await response.text(), /Invalid broker authorization/);
  await broker.close();
});
