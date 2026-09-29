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

test("publishes pending before canceling an archived question", async () => {
  /** @type {Array<{ state: string }>} */
  const published = [];
  /** @type {() => void} */
  let signalPendingPublished = () => {};
  const pendingPublished = new Promise((resolve) => {
    signalPendingPublished = () => resolve(undefined);
  });
  /** @type {() => void} */
  let releaseInitialPublication = () => {};
  const initialPublicationGate = new Promise((resolve) => {
    releaseInitialPublication = () => resolve(undefined);
  });
  const broker = new QuestionBroker({
    createRequestId: () => "request-archive",
    createToken: () => "token-archive",
    scheduleTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
    cancelTimeout: (handle) => clearTimeout(handle),
    timeoutMs: 1_000,
  });
  broker.start();
  const token = broker.issueToken();
  broker.registerAgent("agent-1", token, async (timelineData) => {
    published.push(timelineData);
    if (timelineData.state === "pending") {
      signalPendingPublished();
      await initialPublicationGate;
    }
  });

  try {
    const responsePromise = fetch(`${await broker.getUrl()}/dialog`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ questions: [question] }),
    });
    await pendingPublished;
    broker.unregisterAgent("agent-1");
    assert.deepEqual(
      published.map(({ state }) => state),
      ["pending"],
    );

    releaseInitialPublication();
    const response = await responsePromise;
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      requestId: "request-archive",
      action: "cancel",
    });
    assert.deepEqual(
      published.map(({ state }) => state),
      ["pending", "canceled"],
    );
  } finally {
    releaseInitialPublication();
    await broker.close();
  }
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

test("serves native dialog actions and preserves legacy ask behavior", async () => {
  /** @type {Array<{requestId: string, state: string, protocol?: string, answers?: Array<{questionId: string, note?: unknown}>, action?: string}>} */
  const published = [];
  let requestNumber = 0;
  const broker = new QuestionBroker({
    createRequestId: () => `request-${++requestNumber}`,
    createToken: () => "dialog-token",
    scheduleTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
    cancelTimeout: (handle) => clearTimeout(handle),
    timeoutMs: 1_000,
  });
  broker.start();
  const token = broker.issueToken();
  broker.registerAgent("agent-1", token, async (timelineData) => {
    published.push(timelineData);
  });
  const url = await broker.getUrl();
  /** @param {string} path @param {unknown} body @param {AbortSignal} [signal] */
  const post = (path, body, signal) =>
    fetch(`${url}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
  /** @param {string} requestId @param {string} state */
  const waitForState = async (requestId, state) => {
    while (
      !published.some(
        (item) => item.requestId === requestId && item.state === state,
      )
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    const event = published.find(
      (item) => item.requestId === requestId && item.state === state,
    );
    assert.ok(event);
    return event;
  };

  try {
    const unauthorizedResponse = await fetch(`${url}/dialog`, {
      method: "POST",
      headers: {
        authorization: "Bearer invalid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        questions: [
          { id: "q", prompt: "Q", options: [], selectionMode: "multiple" },
        ],
      }),
    });
    assert.equal(unauthorizedResponse.status, 400);

    const multiQuestion = {
      id: "multi",
      prompt: "Choose any",
      options: [
        { value: "", label: "Empty value", preview: "preview text" },
        { value: "second", label: "Second", description: "details" },
      ],
      selectionMode: "multiple",
    };
    const nativeQuestions = Array.from({ length: 5 }, (_, index) => ({
      ...multiQuestion,
      id: `multi-${index}`,
    }));
    const submitPromise = post("/dialog", { questions: nativeQuestions });
    await waitForState("request-1", "pending");
    await broker.answer({
      agentId: "agent-1",
      requestId: "request-1",
      action: "submit",
      answers: nativeQuestions.map(({ id }) => ({
        questionId: id,
        kind: "selection",
        values: [],
        note: "none",
      })),
    });
    const submitResponse = await submitPromise;
    assert.equal(submitResponse.status, 200);
    assert.deepEqual(await submitResponse.json(), {
      requestId: "request-1",
      action: "submit",
      answers: nativeQuestions.map(({ id }) => ({
        questionId: id,
        kind: "selection",
        values: [],
        note: "none",
      })),
    });
    assert.equal((await waitForState("request-1", "pending")).protocol, "omp");
    assert.equal(
      (await waitForState("request-1", "answered")).answers?.[0]?.note,
      "none",
    );

    const zeroOptionQuestion = {
      id: "empty-options",
      prompt: "No options",
      options: [],
      selectionMode: "multiple",
    };
    const zeroTimeoutPromise = post("/dialog", {
      questions: [zeroOptionQuestion],
      timeoutMs: 0,
    });
    await waitForState("request-2", "pending");
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(
      published.some(
        (item) => item.requestId === "request-2" && item.state === "timed_out",
      ),
      false,
    );
    await broker.answer({
      agentId: "agent-1",
      requestId: "request-2",
      action: "chat",
    });
    assert.deepEqual(await (await zeroTimeoutPromise).json(), {
      requestId: "request-2",
      action: "chat",
    });

    const cancelPromise = post("/dialog", { questions: [multiQuestion] });
    await waitForState("request-3", "pending");
    await broker.answer({
      agentId: "agent-1",
      requestId: "request-3",
      action: "cancel",
    });
    assert.deepEqual(await (await cancelPromise).json(), {
      requestId: "request-3",
      action: "cancel",
    });

    const timeoutResponse = await post("/dialog", {
      questions: [multiQuestion],
      timeoutMs: 10,
    });
    assert.deepEqual(await timeoutResponse.json(), {
      requestId: "request-4",
      action: "timeout",
    });
    assert.equal(
      (await waitForState("request-4", "timed_out")).action,
      "timeout",
    );

    const singleQuestion = {
      id: "single",
      prompt: "Choose one",
      options: [{ value: "yes", label: "Yes" }],
      selectionMode: "single",
    };
    const singlePromise = post("/dialog", { questions: [singleQuestion] });
    await waitForState("request-5", "pending");
    await assert.rejects(
      broker.answer({
        agentId: "another-agent",
        requestId: "request-5",
        action: "chat",
      }),
      /Pending question was not found/,
    );
    await assert.rejects(
      broker.answer({
        agentId: "agent-1",
        requestId: "request-5",
        action: "submit",
        answers: [{ questionId: "single", kind: "selection", values: [] }],
      }),
      /Question requires one selected value/,
    );
    await assert.rejects(
      broker.answer({
        agentId: "agent-1",
        requestId: "request-5",
        action: "submit",
        answers: [
          { questionId: "single", kind: "selection", values: ["unknown"] },
        ],
      }),
      /Answer contains an unknown option/,
    );
    await broker.answer({
      agentId: "agent-1",
      requestId: "request-5",
      action: "submit",
      answers: [
        { questionId: "single", kind: "custom", text: "freeform", note: "why" },
      ],
    });
    assert.deepEqual(await (await singlePromise).json(), {
      requestId: "request-5",
      action: "submit",
      answers: [
        { questionId: "single", kind: "custom", text: "freeform", note: "why" },
      ],
    });

    const controller = new AbortController();
    const disconnectedPromise = post(
      "/dialog",
      { questions: [multiQuestion] },
      controller.signal,
    );
    await waitForState("request-6", "pending");
    controller.abort();
    await assert.rejects(disconnectedPromise);
    await waitForState("request-6", "canceled");
    await assert.rejects(
      broker.answer({
        agentId: "agent-1",
        requestId: "request-6",
        action: "chat",
      }),
      /Pending question was not found/,
    );

    const legacyPromise = post("/ask", { questions: [question] });
    await waitForState("request-7", "pending");
    await broker.answer({
      agentId: "agent-1",
      requestId: "request-7",
      answers: [{ questionId: "scope", kind: "selection", values: ["small"] }],
    });
    assert.deepEqual(await (await legacyPromise).json(), {
      requestId: "request-7",
      answers: [{ questionId: "scope", kind: "selection", values: ["small"] }],
    });
    assert.equal(
      Object.hasOwn(await waitForState("request-7", "pending"), "protocol"),
      false,
    );

    const legacyCancelPromise = post("/ask", { questions: [question] });
    await waitForState("request-8", "pending");
    await broker.answer({
      agentId: "agent-1",
      requestId: "request-8",
      action: "cancel",
    });
    assert.equal((await legacyCancelPromise).status, 499);
    assert.equal(
      (await waitForState("request-8", "canceled")).state,
      "canceled",
    );

    const archivePromise = post("/dialog", { questions: [multiQuestion] });
    await waitForState("request-9", "pending");
    broker.unregisterAgent("agent-1");
    assert.deepEqual(await (await archivePromise).json(), {
      requestId: "request-9",
      action: "cancel",
    });
    assert.equal((await waitForState("request-9", "canceled")).protocol, "omp");
  } finally {
    await broker.close();
  }
});
