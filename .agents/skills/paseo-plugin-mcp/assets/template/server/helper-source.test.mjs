import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createHelperSource } from "./helper-source.ts";

async function withClient(run) {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["--input-type=module", "--eval", createHelperSource()],
  });
  const client = new Client({ name: "mcp-echo-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    await run(client);
  } finally {
    await client.close();
  }
}

test("lists and calls the injected tool over stdio", async () => {
  await withClient(async (client) => {
    const listed = await client.listTools();
    assert.deepEqual(
      listed.tools.map(({ name }) => name),
      ["local_echo"],
    );

    const called = await client.callTool({
      name: "local_echo",
      arguments: { text: "ready" },
    });
    assert.deepEqual(called, {
      content: [{ type: "text", text: "READY" }],
    });
  });
});

test("returns a tool error for oversized text", async () => {
  await withClient(async (client) => {
    const called = await client.callTool({
      name: "local_echo",
      arguments: { text: "x".repeat(257) },
    });
    assert.equal(called.isError, true);
  });
});
