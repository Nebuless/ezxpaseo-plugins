---
name: paseo-plugin-rpc
description: Build and verify schema-validated Paseo plugin RPCs with shared contracts, daemon handlers, client callers, and SDK-backed host actions. Use when a plugin needs daemon-local files, credentials, vendor APIs, or plugin-only backend behavior.
---

# Paseo plugin RPCs

Build the RPC end to end. Do not use an RPC for an operation already exposed by the selected host's
Paseo SDK.

## Reference index

| Goal                        | Read                                | Template                             |
| --------------------------- | ----------------------------------- | ------------------------------------ |
| Define schemas and imports  | [Guide](references/contracts.md)    | [Complete template](assets/template) |
| Verify errors and transport | [Guide](references/verification.md) | [Complete template](assets/template) |

## Read first

- [RPC contract and runtime boundaries](references/contracts.md)
- [RPC failure and verification guide](references/verification.md)
- Copyable implementation: [assets/template](assets/template)
- Suite validator: [../paseo-plugin-authoring/scripts/validate-plugin.mjs](../paseo-plugin-authoring/scripts/validate-plugin.mjs)

## Workflow

1. Classify every module as `shared`, `client`, or `server`; type imports follow the same boundary.
2. Define one `defineRpc()` contract in `shared/` with bounded Zod input and output schemas.
3. Put secrets, filesystem access, and daemon-local work in `server/`.
4. Accept `PluginHandlerContext` only when the handler needs `{ paseo }`; it has no `signal`.
5. Register the handler with `server.handle()` and call it through `rpc()` or `useRpc()`.
6. Use the handler's existing Paseo SDK session for normal daemon operations; never open a socket.
7. Return entry cleanup and any explicit registration cleanup.
8. From the repository root, validate and test the copied plugin:

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
cd /absolute/path/to/plugin
npm install
npm run typecheck
npm test
```

9. Exercise one valid request and one schema rejection in the real host.

The suite validator is static preflight only. It does not prove installation, host status, RPC
transport, or user-visible behavior. This skill requires the sibling `paseo-plugin-authoring` skill
to be installed with the suite.

## Edge cases

- Reject unbounded strings, arrays, and opaque objects at the shared schema.
- Output validation can fail after side effects. Compute and validate output before irreversible work.
- Pending RPCs reject when the plugin reloads, stops, or disconnects.
- RPC names start with a lowercase letter and use lowercase letters, numbers, dots, hyphens, or
  underscores.
- Client code may import only the exact host module allowlist. Use `zod`, never `zod/v4`.
- Keep `PluginHookContext.signal` in hooks. Do not invent it on `PluginHandlerContext`.

## Done gate

- Shared input and output schemas are bounded and tested.
- The handler performs the requested real action and uses the supplied Paseo SDK where applicable.
- Client and server imports obey runtime boundaries.
- Typecheck and tests pass.
- Real reload, `plugin ls`, logs, valid behavior, and invalid-input behavior were observed.

Before live reload or installation, read [trust gates](../paseo-plugin-authoring/references/quality-gates.md). Obtain authorization, then reload the exact runtime ID, inspect `paseo plugin ls <runtime-id>` and `paseo plugin logs <runtime-id>`, and exercise the behavior.
