import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

const require = createRequire(import.meta.url);

async function moduleFor(skill, path) {
  const entry = fileURLToPath(new URL(`../../${skill}/assets/template/${path}`, import.meta.url));
  const output = await build({ entryPoints: [entry], bundle: true, write: false, platform: "node", format: "cjs", external: ["@getpaseo/plugin", "zod", "react", "react-native", "@getpaseo/plugin/*"] });
  const module = { exports: {} };
  new Function("require", "module", "exports", output.outputFiles[0].text)(require, module, module.exports);
  return module.exports;
}

test("attachment search returns valid bounded snapshots for empty, matching and missing queries", async () => {
  const { searchResources } = await moduleFor("paseo-plugin-attachments", "server/resources.ts");
  const { searchDemoResources } = await moduleFor("paseo-plugin-attachments", "shared/resources.ts");
  assert.equal(searchDemoResources.output.parse(searchResources({ query: "" })).items.length, 2);
  assert.equal(searchResources({ query: "QUICKSTART" }).items.length, 1);
  assert.deepEqual(searchResources({ query: "not-a-topic" }), { items: [] });
  assert.equal(searchDemoResources.input.safeParse({ query: "x".repeat(101) }).success, false);
});

test("settings defaults and timeline payload reject invalid data", async () => {
  const { preferences } = await moduleFor("paseo-plugin-settings", "shared/preferences.ts");
  assert.deepEqual(preferences.schema.parse({}), { displayName: "Paseo user", showHints: true });
  assert.equal(preferences.schema.safeParse({ displayName: " " }).success, false);
  const { reasoningCardSchema } = await moduleFor("paseo-plugin-timeline", "shared/reasoning-card.ts");
  assert.equal(reasoningCardSchema.safeParse({ text: "ready", phase: "streaming" }).success, true);
  assert.equal(reasoningCardSchema.safeParse({ text: "ready", phase: "pending" }).success, false);
});

test("hook registrations preserve environment, bound follow-ups per agent, and remove cleanly", async () => {
  const { default: contribute } = await moduleFor("paseo-plugin-hooks", "index.server.ts");
  const callbacks = new Map();
  const register = (name, callback) => { callbacks.set(name, callback); return () => callbacks.delete(name); };
  const cleanup = contribute({ on: register, before: register });
  const before = callbacks.get("agent.session_open");
  const interactive = { purpose: "interactive", env: { KEEP: "yes" } };
  assert.deepEqual(before({ request: interactive }).env, { KEEP: "yes", PASEO_HOOKS_POLICY: "interactive" });
  const history = { purpose: "history", env: {} };
  assert.equal(before({ request: history }), history);
  const sent = [];
  const context = { paseo: { agents: { ref: (id) => ({ send: async (text) => sent.push({ id, text }) }) } } };
  const event = { agent: { id: "agent-1" }, outcome: { kind: "completed" }, turnId: "turn-1", timeline: [{ type: "assistant_message", text: "[retry-once]" }] };
  const ended = callbacks.get("agent.turn_ended");
  await Promise.all([ended(event, context), ended({ ...event, turnId: "turn-2" }, context)]);
  assert.equal(sent.length, 1);
  await ended({ ...event, agent: { id: "agent-2" } }, context);
  assert.equal(sent.length, 2);
  cleanup();
  assert.equal(callbacks.size, 0);
});

test("MCP injection preserves existing servers and skips incompatible OMP and internal agents", async () => {
  const { default: contribute } = await moduleFor("paseo-plugin-mcp", "index.server.ts");
  let create;
  const cleanup = contribute({ before: (_name, callback) => { create = callback; return () => { create = undefined; }; } });
  for (const config of [{ provider: "omp" }, { provider: "codex", internal: true }]) {
    const request = { config };
    assert.equal(create({ request }), request);
  }
  const existing = { type: "http", url: "https://example.com/mcp" };
  const request = { config: { provider: "codex", mcpServers: { existing } } };
  const transformed = create({ request });
  assert.equal(transformed.config.mcpServers.existing, existing);
  assert.equal(transformed.config.mcpServers["local-echo"].command, "node");
  assert.throws(() => create({ request: transformed }), /already configured/);
  cleanup();
  assert.equal(create, undefined);
});
