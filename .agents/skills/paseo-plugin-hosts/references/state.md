# Cache and connection state

Checked 2026-09-29.

Sources:

- Paseo plugin reference, borrowed API lifecycle table:
  https://paseo.sh/docs/plugins/reference.md#discover-hosts-and-target-another-host
- Paseo plugin reference, entry cleanup:
  https://paseo.sh/docs/plugins/reference.md#entry-point-and-cleanup
- Agent Skills specification, focused references:
  https://agentskills.io/specification

Cache data by `(serverId, arguments)`. Do not cache a `PaseoApi` object. A host label is not an
identity.

Retained APIs:

- remain usable when the same connection reconnects;
- are released when connection settings change or the app switches connections;
- become unknown when the host is removed;
- are released with all observations when the plugin unloads.

Reacquire for each explicit action. Release individual subscriptions through their normal SDK
cleanup. Do not call `dispose()` on a borrowed API merely to finish one action; that releases the
plugin's API handle and observations.

For async UI, increment a request token before the call and compare it after completion. Increment
again on unmount. A late result from an older host or args must not overwrite the current view.
