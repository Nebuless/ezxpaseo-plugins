# Command and slash contracts

Checked: 2026-09-29

Sources:

- [Paseo plugin reference: Command Center items](https://paseo.sh/docs/plugins/reference.md#command-center-items)
- [Paseo plugin reference: slash commands](https://paseo.sh/docs/plugins/reference.md#slash-commands)

Command callbacks receive the selected host's `paseo`, typed `rpc`, `openSurface`, and
`openSettings`; contextual callbacks also receive cached snapshots and `openPanel`.

Slash `args` is the trimmed raw remainder after the command name. Paseo owns autocomplete, input
clearing, and error toast, but not pending UI. Client slash commands never send their text to the
agent.
