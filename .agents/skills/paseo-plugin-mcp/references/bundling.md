# Bundling-safe stdio helpers

Checked 2026-09-29.

Sources:

- Paseo plugin reference, server runtime:
  https://paseo.sh/docs/plugins/reference.md#server-runtime
- Paseo plugin reference, configuration and MCP injection:
  https://paseo.sh/docs/plugins/reference.md#change-configuration-and-inject-an-mcp-server
- Existing installed paseo-plugin skill's `references/runtime-bundling.md` and this repository's
  `paseo-ask-user/server/mcp-server-source.mjs` demonstrate self-contained helper injection.
  These are local examples, not an asserted upstream repository path.

Paseo compiles `index.server.ts` and reachable server/shared modules into a bundle evaluated by a
plugin subprocess. The bundle is not the source entry.

Unsafe file discovery:

- `join(process.cwd(), "server", "helper.mjs")`
- `new URL("./helper.mjs", import.meta.url)`
- hardcoded installation paths

Safe small-helper injection:

```ts
{
  type: "stdio",
  command: "node",
  args: ["--input-type=module", "--eval", helperSource],
}
```

The program string must contain all runtime logic other than Node globals and explicitly supplied
environment values. Use direct argv, never a shell.

Secrets do not belong in generated source. Add them to the launch override map in
`agent.session_open`, preserving `request.env`.

Provider MCP support is not universal. This repository's OMP adapter rejects session MCP servers,
so the template skips `provider === "omp"` and internal agents. Verify each supported provider before
injecting. OMP needs its native companion rather than treating failed agent creation as tool setup.
