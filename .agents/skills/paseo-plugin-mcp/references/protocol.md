# Protocol and packaging

Checked 2026-09-29.

Sources:

- Model Context Protocol TypeScript SDK:
  https://github.com/modelcontextprotocol/typescript-sdk
- Paseo plugin reference, runtime entries and package build:
  https://paseo.sh/docs/plugins/reference.md#project-files
- Paseo runtime bundling guidance:
  https://paseo.sh/docs/plugins/reference.md#runtime-modules

## Minimum stdio behavior

A helper must handle newline-delimited JSON-RPC requests for:

- `initialize`
- `notifications/initialized`
- `ping`
- `tools/list`
- `tools/call`

Return JSON-RPC errors for invalid requests, unknown methods, and invalid parameters. Bound both the
input buffer and every schema field.

Use `@modelcontextprotocol/sdk` as the independent test client. Connect over
`StdioClientTransport`, list the tool, and perform a complete tool call. Discovery alone is not
proof.

## Dependency and lock handling

The template uses `@modelcontextprotocol/sdk` only as its independent test client, so it is a
development dependency. The embedded helper has no package imports. It needs no production
dependency installation or manifest build command. `node --eval` launched in an agent directory
cannot rely on resolving the plugin's `node_modules`.

If a derived plugin actually imports a server runtime dependency, add it to dependencies. For Git
distribution generate and review a lockfile, then declare direct `npm ci --omit=dev` preparation.
For npm distribution, production dependencies are already installed by acquisition. Do not add
build commands for test tooling.
