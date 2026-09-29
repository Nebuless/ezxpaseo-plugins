# Direct provider protocol

Checked 2026-09-29.

Sources:

- Complete provider plugin guide:
  https://paseo.sh/docs/plugins/providers.md
- Exact provider runtime and icon rules:
  https://paseo.sh/docs/plugins/reference.md#providers
- Provider SDK source contract:
  https://github.com/getpaseo/paseo/blob/main/packages/plugin/src/server/provider.ts

Use `ProviderRegistration` only when the agent has a TypeScript SDK, JSON-RPC API, or custom process
protocol rather than ACP.

## Connection

`connect()` negotiates versions and capabilities and returns:

- `version`
- `capabilities`
- `send(input): Promise<void>`
- `onEvent(listener): () => void`
- `close(): Promise<void>`

`send()` accepts work. Results, failures, configuration, permissions, persistence, and timeline
changes are events.

## Minimum usable sequence

1. `catalog` request -> `catalog` event with models, modes, and defaults.
2. `session.open` -> create or restore native session.
3. `session.opened` -> effective capabilities, restoration mode, cwd, and persistence.
4. `session.config` -> committed effective values.
5. `session.ready`.
6. `session.prompt` -> user timeline item with matching `clientMessageId`.
7. Exactly one `session.prompt_result`.
8. `session.turn` started.
9. Complete timeline snapshots with stable item IDs.
10. One terminal turn event.

Advertise only implemented capabilities. Persistence requires replay or explicit skip behavior.
Refresh is close plus reopen, so `session.open` must re-read credentials, environment, global
configuration, and MCP servers.

`close()` stops every native session and releases processes, subscriptions, and pending work.
