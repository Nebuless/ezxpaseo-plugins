import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  ASK_BROKER_TOKEN_ENV,
  ASK_BROKER_URL_ENV,
  ASK_TOOL_NAME,
} from "../shared/ask-schema.mjs";
import { createMcpServerSource } from "./mcp-server-source.mjs";
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

/**
 * @param {string} _placeholder
 * @param {string} environmentName
 */
function replaceEnvironmentPlaceholder(_placeholder, environmentName) {
  return process.env[environmentName] ?? "";
}

/** @param {string} argument */
function applyPaseoCommandInterpolation(argument) {
  return argument.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
    replaceEnvironmentPlaceholder,
  );
}

function createInterpolatedMcpServerSource() {
  return applyPaseoCommandInterpolation(createMcpServerSource());
}

test("protects the MCP server from command argument interpolation", () => {
  const source = createMcpServerSource();
  assert.equal(source.includes("${"), false);
  assert.equal(applyPaseoCommandInterpolation(source), source);
});

test("advertises the Paseo ask-user tool over MCP stdio", async () => {
  const transport = new StdioClientTransport({
    command: "node",
    args: [
      "--input-type=module",
      "--eval",
      createInterpolatedMcpServerSource(),
    ],
    env: {
      ...process.env,
      [ASK_BROKER_URL_ENV]: "http://127.0.0.1:1",
      [ASK_BROKER_TOKEN_ENV]: "test-token",
    },
  });
  const client = new Client({ name: "paseo-ask-user-test", version: "0.1.0" });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map(({ name }) => name),
      [ASK_TOOL_NAME],
    );
  } finally {
    await client.close();
  }
});

test("forwards an MCP tool call to the question broker", async () => {
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
  const transport = new StdioClientTransport({
    command: "node",
    args: [
      "--input-type=module",
      "--eval",
      createInterpolatedMcpServerSource(),
    ],
    env: {
      ...process.env,
      [ASK_BROKER_URL_ENV]: await broker.getUrl(),
      [ASK_BROKER_TOKEN_ENV]: token,
    },
  });
  const client = new Client({ name: "paseo-ask-user-test", version: "0.1.0" });
  try {
    await client.connect(transport);
    const responsePromise = client.callTool({
      name: ASK_TOOL_NAME,
      arguments: { questions: [question] },
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
    assert.deepEqual(response, {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            requestId: "request-1",
            answers: [
              {
                questionId: "scope",
                kind: "selection",
                values: ["small"],
              },
            ],
          }),
        },
      ],
    });
  } finally {
    await client.close();
    await broker.close();
  }
});
