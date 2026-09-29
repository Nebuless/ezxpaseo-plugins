---
name: paseo-plugin-hosts
description: Build and verify multi-host Paseo plugin UI using selected-host context, useHosts, and getPaseoClient without extra sockets or failover. Use when a client contribution must display host state or explicitly run SDK actions on another configured host.
---

# Paseo plugin hosts

Borrow Paseo's existing authenticated host connections. Never create a socket, infer a host URL, or
fall through to another host when the requested host is disconnected.

## Reference index

| Goal | Read | Template |
| --- | --- | --- |
| Select or explicitly target host | [Guide](references/clients.md) | [Complete template](assets/template) |
| Cache values and guard late results | [Guide](references/state.md) | [Complete template](assets/template) |

## Read first

- [Host selection and borrowed clients](references/clients.md)
- [Caching, reconnects, and stale async work](references/state.md)
- Copyable implementation: [assets/template](assets/template)
- Suite validator: [../paseo-plugin-authoring/scripts/validate-plugin.mjs](../paseo-plugin-authoring/scripts/validate-plugin.mjs)

## Workflow

1. Use the surface or panel `host` prop for the selected host.
2. Use `useHosts()` to render every configured host, including disconnected hosts.
3. Put `getPaseoClient(serverId)` inside an explicit user callback. Acquire the current API for each
   action.
4. Require `status === "online"` before enabling or running the action. Never choose a replacement
   host automatically.
5. Key cached data by host ID and every request argument. Cache values, not `PaseoApi` handles.
6. Guard async completion with an incrementing request token when host selection, args, or component
   lifetime can change before completion.
7. Reacquire after connection settings change. Release subscriptions and avoid retaining old APIs.
8. Validate and test:

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
cd /absolute/path/to/plugin
npm install
npm run typecheck
npm test
```

9. Exercise selected-host and explicit-other-host actions, then disconnect the target and verify
   there is no failover.

The suite validator is static preflight only. It does not prove connection state, host selection,
cache isolation, or UI behavior. Install this skill with the sibling `paseo-plugin-authoring` suite.

## Edge cases

- `useHosts()` includes idle, connecting, online, offline, and error hosts.
- Unknown or disconnected IDs throw. Calls never fall through to another host.
- Retained APIs survive a reconnect on the same connection, but are released when connection
  settings change or the app switches connections.
- Plugin unload releases every borrowed API and observation.
- Explicitly acquired APIs keep their target when the surface host picker changes.
- Cache entries must include host ID and args; never share selected-host results across hosts.
- Ignore a late completion after a newer request or unmount.

## Done gate

- Selected host and all configured hosts are shown distinctly.
- Every cross-host action is explicit and online-gated.
- No extra client or socket is constructed.
- APIs are acquired at action time and not retained in cache.
- Cache keys include host and args; late async results are guarded.
- Typecheck, tests, reload, running status, logs, online action, and disconnected no-failover pass.

Before live reload or installation, read [trust gates](../paseo-plugin-authoring/references/quality-gates.md). Obtain authorization, then reload the exact runtime ID, inspect `paseo plugin ls <runtime-id>` and `paseo plugin logs <runtime-id>`, and exercise the behavior.
