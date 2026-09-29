# Lifecycle and ordering

Checked 2026-09-29.

Sources:

- Paseo plugin reference, lifecycle hooks:
  https://paseo.sh/docs/plugins/reference.md#lifecycle-hooks
- Paseo plugin reference, ordering and returned values:
  https://paseo.sh/docs/plugins/reference.md#ordering-and-returned-values
- Paseo lifecycle-actions example:
  https://github.com/getpaseo/paseo/tree/main/plugin-examples/lifecycle-actions

## Registrations

`server.on(name, callback)` receives `(event, { paseo, signal })` and returns an idempotent remover.
`server.before(name, callback)` receives `({ request }, { paseo, signal })` and returns a modified
request or `undefined`.

Before hooks:

- `agent.create`: edit public configuration except `cwd`, plus optional `env`.
- `agent.session_open`: edit only `env`; receives `reason` and `purpose`.
- `workspace.create`: edit the explicit workspace creation request.

## Order

Paseo runs plugins by plugin ID, then callbacks in registration order within each plugin. Each
callback receives the prior callback's complete returned request. There is no deep merge.

`agent.session_open` runs for create, resume, refresh, and import. `purpose` is `"interactive"` or
`"history"`. A history session commonly needs no interactive-only credential or instrumentation.

Hooks time out after 30 seconds. Timeout aborts `context.signal`. A before-hook failure cancels the
pending operation. An event-handler failure is logged and the original operation continues.
