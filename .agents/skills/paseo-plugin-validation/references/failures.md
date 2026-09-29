# Failure diagnosis

Source: https://paseo.sh/docs/plugins/reference#load-failures and https://paseo.sh/docs/plugins/reference#debug-backend-output. Checked 2026-09-29.

| Symptom | Inspect / fix |
| --- | --- |
| Disabled | Root pluginsEnabled and per-install enabled separately |
| Old plugin diagnostic | Mixed index.ts or missing range; complete migration |
| Client module unavailable | Exact host allowlist, including zod not zod/v4 |
| Server/client module compiler error | Runtime directories and transitive type imports |
| No sidebar | Running, selected host, registered surface first, valid icon |
| No Command Center action | Context cached record and matching focused agent/workspace |
| Slash unavailable | Built-in alias collision, catalog-order winner, draft context, attachments |
| RPC rejects | Input/output schemas and server error, not extra socket |
| Timeline unavailable | Kind/version renderer, schema, installed/running host |
| Append rejected | Plugin session, advertised feature and 64KiB serialized data |
| Stale source | Reload exact runtime ID; no daemon restart |
| Local reload failed | Fix compile/init issue and reload; old bundle not restored |
| Managed update failed | Old installation preserved; inspect candidate error |

Backend `console.log` does not corrupt IPC. `paseo plugin logs <id>` is snapshot, not stream. Tail bounded to 500 entries/256KiB, lines 16KiB, survives reload/disable/failure, clears on removal/daemon restart. Client errors live in app console. Daemon also writes structured copies to daemon.log. Never log secrets.

Host runtime differs from local tsc: SDK pin may be stale; npm dependency resolves locally but client host denies it; server eval bundle has no source-file import.meta path. Fix those mechanisms rather than adding hardcoded paths or daemon restarts.
