# Entry migration

Source: https://paseo.sh/docs/plugins/migration. Checked 2026-09-29.

Old mixed `index.ts` becomes default `index.client.ts[x]` and/or `index.server.ts[x]`. At least one. `name.client.tsx` moves to `client/name.tsx`, `.server.ts` to `server/name.ts`, `.shared.ts` to `shared/name.ts`. Runtime directories, not suffixes, control compilation. Preserve nesting and update imports after moves. Root retains JSON configs and entries, not helper code.

`plugin.handle` becomes `server.handle`. UI registrations become `client.add*`. `addClientSide` wrapper disappears, body moves to client entry. `addClientSlashCommand` becomes `addSlashCommand`. Shared `defineRpc`, `defineSettings`, `defineAttachmentSource` import root SDK. Hook/server contexts import `/server`, client hooks/contexts `/client`.

Do not retain old mixed root or reinterpret missing requirements as unrestricted. Run original regression tests before/after. Local reload does not restore previous bundle on failure, so keep edited source reviewable and diagnose rather than restarting daemon.
