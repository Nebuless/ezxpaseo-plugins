# Selected hosts and borrowed clients

Checked 2026-09-29.

Sources:

- Paseo plugin reference, discover hosts and target another host:
  https://paseo.sh/docs/plugins/reference.md#discover-hosts-and-target-another-host
- Paseo plugin reference, hosts and lifecycle:
  https://paseo.sh/docs/plugins/reference.md#hosts-and-lifecycle
- Paseo hosts plugin example:
  https://github.com/getpaseo/paseo/tree/main/plugin-examples/hosts

Surface and panel props include selected `host.id` and `host.label`. `usePaseo()` follows that
selection.

`useHosts()` returns configured hosts with:

- `serverId`
- `label`
- `status`: `idle`, `connecting`, `online`, `offline`, or `error`

`getPaseoClient(serverId)` borrows the app's existing authenticated API. It opens no socket and
exposes no connection lifecycle controls. Acquire it inside the user action so connection
replacement yields the current API.

An unknown ID or disconnected target throws. There is no failover. Surface host selection does not
retarget an explicitly acquired API.
