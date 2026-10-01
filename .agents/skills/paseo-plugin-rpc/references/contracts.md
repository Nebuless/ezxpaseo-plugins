# RPC contracts

Checked 2026-09-29.

Sources:

- Paseo plugin reference, runtime modules and plugin-specific backend behavior:
  https://paseo.sh/docs/plugins/reference.md#add-plugin-specific-backend-behavior
- Paseo plugin reference, client and server runtime allowlists:
  https://paseo.sh/docs/plugins/reference.md#runtime-modules
- Agent Skills specification, skill layout and progressive disclosure:
  https://agentskills.io/specification

## Contract shape

Define the contract in `shared/`:

```ts
defineRpc({
  name: "notes.publish",
  input: z.object({ agentId: z.string().min(1).max(128) }),
  output: z.object({ itemId: z.string().min(1).max(160) }),
});
```

`RpcInput<C>` is the parsed handler input. `RpcOutput<C>` is the caller result. Inputs and outputs
are validated on both sides of the plugin transport.

`server.handle(contract, handler)` receives `(input, context)`. In SDK 0.9.2,
`PluginHandlerContext` contains only `paseo`. It does not contain `signal`; cancellation belongs to
`PluginHookContext`.

## Runtime boundary

- `shared/`: Zod contracts and plain values only.
- `server/`: Node APIs, credentials, files, processes, and handler implementation.
- `client/`: React Native UI and client callbacks.
- Root: only `index.client.tsx`, `index.server.ts`, manifest, package files, and assets.

Client imports are exact: `@getpaseo/plugin`, `/client`, `/client/ui`,
`/client/react-native`, `@tanstack/react-query`, `react`, `react/jsx-runtime`, `react-native`, and
`zod`. Package subpaths such as `zod/v4` are not host-provided.

## API choice

Use the selected host's `paseo` object for workspaces, agents, providers, and daemon configuration.
Use plugin RPC only for plugin-specific daemon behavior. A server handler may use its supplied
`context.paseo`; it must not construct a second client.
