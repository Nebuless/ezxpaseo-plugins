# Settings contracts

Checked: 2026-09-29

Sources:

- [Paseo plugin reference: settings screens](https://paseo.sh/docs/plugins/reference.md#settings-screens)
- [Paseo plugin reference: persisted values](https://paseo.sh/docs/plugins/reference.md#persisted-values)

`defineSettings` requires a lowercase ID, `scope: "host"`, positive schema version, and a Zod
schema whose defaults parse `{}` into a complete document. Register it before server cleanup.

`useSettings` returns `loading`, `ready`, `invalid`, or `error`, plus `saving`, `saveError`,
`save`, `reset`, and `reload`. Values persist across daemon restart, plugin reload, disable, and
update. Removing the installation deletes them.

The `>=0.9.2 <0.10.0` range is this template's tested baseline, not an API introduction date.
