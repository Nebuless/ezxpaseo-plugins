---
name: paseo-plugin-mcp
description: Build and verify Paseo plugins that inject safe stdio MCP helpers into agent configuration. Use when an agent needs a small local tool and the helper must survive plugin bundling without source-path assumptions or embedded secrets.
---

# Paseo plugin MCP helpers

Inject a self-contained stdio helper with direct argv. Do not locate helper files from
`process.cwd()` or `import.meta`, and do not move a working stdio design to a reload-stale HTTP
broker.

## Reference index

| Goal | Read | Template |
| --- | --- | --- |
| Inject bundle-safe helper | [Guide](references/bundling.md) | [Complete template](assets/template) |
| Validate protocol and packaging | [Guide](references/protocol.md) | [Complete template](assets/template) |

## Read first

- [Bundling-safe stdio helpers](references/bundling.md)
- [Protocol, packaging, and verification](references/protocol.md)
- Copyable implementation: [assets/template](assets/template)
- Suite validator: [../paseo-plugin-authoring/scripts/validate-plugin.mjs](../paseo-plugin-authoring/scripts/validate-plugin.mjs)

## Workflow

1. Define one bounded, deterministic tool contract.
2. Generate a self-contained helper program string inside the server bundle.
3. Inject `{ type: "stdio", command: "node", args: ["--input-type=module", "--eval", source] }`.
4. Pass argv directly. Never concatenate a shell command.
5. Keep secrets out of generated source. If a tool needs secrets, inject names and values through
   `agent.session_open.env`.
6. Preserve existing MCP servers and reject a name collision.
7. Test the helper through `@modelcontextprotocol/sdk`: connect, list tools, make one real call, and
   exercise invalid input.
8. Validate and test:

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
cd /absolute/path/to/plugin
npm install
npm run typecheck
npm test
```

9. Start a new agent and call the injected tool. Existing agents retain captured MCP configuration.

The suite validator is static preflight only. It cannot prove stdio negotiation, tool execution, or
host reload. Install this skill with the sibling `paseo-plugin-authoring` suite.

## Edge cases

- Server entries run from a compiled subprocess bundle, not the plugin source directory.
- `process.cwd()` is the daemon or agent working directory. `import.meta` does not locate source.
- Bound input buffering and tool arguments to prevent memory growth.
- Handle malformed JSON-RPC, unknown methods, and unknown tools without crashing the helper.
- The template uses the official SDK as the test client. The helper stays dependency-free so
  `node --eval` does not depend on package resolution from an agent working directory.
- The SDK is only a development test client. The self-contained helper needs no production
  dependencies or preparation command. Add Git lockfile preparation only for actual runtime dependencies.
- Do not inject dynamic HTTP broker URLs or tokens at creation time. Reload can leave existing
  agents holding stale endpoints and credentials.

## Done gate

- Helper source is self-contained and uses direct argv.
- No source path, working-directory, shell, or source-embedded secret assumption exists.
- Official SDK test lists and calls the tool.
- Invalid and oversized inputs return bounded errors.
- Typecheck and tests pass.
- A newly created agent calls the tool after real reload and running-status verification.

Before live reload or installation, read [trust gates](../paseo-plugin-authoring/references/quality-gates.md). Obtain authorization, then reload the exact runtime ID, inspect `paseo plugin ls <runtime-id>` and `paseo plugin logs <runtime-id>`, and exercise the behavior.
