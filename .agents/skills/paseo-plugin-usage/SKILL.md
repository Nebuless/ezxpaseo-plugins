---
name: paseo-plugin-usage
description: Build and verify Paseo usage-source plugins that discover configured accounts, derive stable safe account keys, and report cached quota windows, balances, details, and statuses. Use when surfacing real local or vendor metering in Paseo.
---

# Paseo usage sources

Usage sources require Paseo and `@getpaseo/plugin` 0.9.3 or newer. Do not typecheck a usage source
against SDK 0.9.2; that package does not export `/server/usage`.

## Reference index

| Goal                                 | Read                            | Template                             |
| ------------------------------------ | ------------------------------- | ------------------------------------ |
| Discover account and stable identity | [Guide](references/identity.md) | [Complete template](assets/template) |
| Report windows and cache behavior    | [Guide](references/reports.md)  | [Complete template](assets/template) |

Use [sample meter JSON](assets/local-meter.json) only to learn the input shape. Set
`PASEO_LOCAL_USAGE_FILE` on the daemon to a file written by the actual local meter.

## Read first

- [Usage identity and discovery](references/identity.md)
- [Reports, status, and caching](references/reports.md)
- Copyable local-metering template: [assets/template](assets/template)
- Suite validator: [../paseo-plugin-authoring/scripts/validate-plugin.mjs](../paseo-plugin-authoring/scripts/validate-plugin.mjs)

## Workflow

1. Pin `@getpaseo/plugin` to `0.9.3` and require `>=0.9.3 <0.10.0`.
2. Define a bounded Zod input identifying how to reach one configured account.
3. Make `discover()` return configured inputs, or `[]` when no account is configured.
4. Make `identify()` return a stable account key without fetching usage. Never use credentials or
   raw email. Use `hashAccountKey()` when the stable identity is sensitive.
5. Make `fetch()` report real measured data. Return `available`, `unavailable`, or `error`
   deliberately.
6. Do not add a second five-minute cache; Paseo caches each report and force-refreshes returned IDs.
7. Validate and test:

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
cd /absolute/path/to/plugin
npm install
npm run typecheck
npm test
```

8. Call `usage.list_reports`, inspect the account label and `fetchedAt`, then force-refresh the same
   report.

The suite validator is static preflight only. It cannot prove discovery, host caching, source status,
or rendering. Install this skill with the sibling `paseo-plugin-authoring` suite.

## Edge cases

- An account key is 1-128 characters from `[A-Za-z0-9._-]`, stable across token rotation and routes.
- `identify()` returns `null` when credentials or local account configuration are absent.
- A configured account may validly return `status: "available"` with empty windows.
- `unavailable` means the account cannot currently supply usage; `error` means the source failed to
  interpret or retrieve it.
- `forceRefresh` bypasses Paseo's five-minute cache only for returned requested IDs.
- Source icons follow the self-contained SVG and 64 KiB provider restrictions.
- The template is real local metering. It does not claim to represent a vendor API.

## Done gate

- SDK and manifest minimum are both 0.9.3.
- Discovery returns no synthetic account when configuration is absent.
- Account identity contains no credential or raw email.
- Available, unavailable, error, generated-window, and empty-window behavior are documented.
- Local tests pass and 0.9.3 typecheck passes when that SDK is available.
- Real reload, status, logs, list, cache, and force-refresh behavior pass.

Before live reload or installation, read [trust gates](../paseo-plugin-authoring/references/quality-gates.md). Obtain authorization, then reload the exact runtime ID, inspect `paseo plugin ls <runtime-id>` and `paseo plugin logs <runtime-id>`, and exercise the behavior.

Availability checked 2026-09-29: npm registry has no `@getpaseo/plugin@0.9.3`; installed repo SDK is 0.9.2. Template matches documented upcoming API but cannot currently install or pass full SDK typecheck. Keep that check blocked until compatible package and daemon are available. Do not substitute 0.9.2 or claim current-runtime support.
