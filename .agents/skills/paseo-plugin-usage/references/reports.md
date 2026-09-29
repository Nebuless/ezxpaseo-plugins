# Usage reports and caching

Checked 2026-09-29.

Sources:

- Paseo plugin reference, report fields and cache:
  https://paseo.sh/docs/plugins/reference.md#usage-sources
- Paseo SDK usage helpers and report types:
  https://github.com/getpaseo/paseo/blob/main/packages/plugin/src/server/usage.ts
- Agent Skills specification, references and templates:
  https://agentskills.io/specification

`fetch()` returns:

- `status`: `available`, `unavailable`, or `error`;
- optional `planLabel`;
- `windows`;
- optional `balances` and `details`;
- optional `error`.

Use `windowFromUsedPct()` and tone helpers for percentage windows. Set `headline: true` on the
primary window.

An available account can have `windows: []`: for example, a configured local account with no
recorded activity in the current period. Make that state explicit in `details` rather than
fabricating utilization.

`usage.list_reports` caches each report for five minutes. `forceRefresh` refreshes only IDs returned
for that request. Source code should not add a duplicate cache unless the upstream contract needs a
different independent cache.

The template reads a documented local JSON meter. A present window becomes a real activity window;
an absent window produces an available empty-window report. It makes no vendor claim.

Set daemon environment `PASEO_LOCAL_USAGE_FILE` to an absolute host path containing this JSON shape.
The skill's `assets/local-meter.json` is sample input, not real usage. Replace counts and timestamps
with recorded data. Omit `window` for a configured account with no recorded window. `actionLimit`
must be positive, `usedActions` nonnegative integer, and timestamps valid ISO strings. Do not treat
an expired window as current quota. A derived meter must define its measurement period and writer.

The public docs require 0.9.3 but npm registry has no such SDK on 2026-09-29. Current upstream source
has usage contracts while its package version is already 0.10.0. This is not proof of a published
0.9.3 artifact. Full template typecheck remains explicitly blocked until compatible SDK is available.
