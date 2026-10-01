# Usage identity and discovery

Checked 2026-09-29.

Sources:

- Paseo plugin reference, usage sources:
  https://paseo.sh/docs/plugins/reference.md#usage-sources
- Paseo SDK usage contract:
  https://github.com/getpaseo/paseo/blob/main/packages/plugin/src/server/usage.ts
- Codex usage-source identity example:
  https://github.com/getpaseo/paseo/blob/main/plugins/codex-usage-source/server/usage.ts

Usage sources require Paseo 0.9.3 or newer and import from
`@getpaseo/plugin/server/usage`.

`discover()` returns JSON inputs for accounts configured on the daemon host. Return `[]` when no
account is configured. Do not invent a default account.

`identify(input)` returns `{ key, label? }` without fetching usage, or `null` when configuration or
credentials are absent. The daemon forms `<sourceId>:<accountKey>`.

The key:

- is 1-128 characters from `[A-Za-z0-9._-]`;
- remains stable across credential rotation and input routes;
- identifies the metered account or organization;
- is never a token, secret, or raw email.

Use `hashAccountKey(value)` when the only stable identity is sensitive. A display label may contain
human-readable account information, but it is not the key.
