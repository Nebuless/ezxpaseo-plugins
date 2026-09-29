---
name: paseo-plugin-settings
description: Build host-scoped Paseo plugin settings with shared Zod schemas, server registration, revision-safe drafts, and complete client states. Use when plugin configuration must persist across reloads and synchronize across clients.
compatibility: Paseo plugin SDK 0.9.2; templates require Node.js and TypeScript for local validation.
---

# Paseo plugin settings

| Goal | Read | Start from |
| --- | --- | --- |
| Define and persist settings | [Settings contracts](references/settings.md) | [template](assets/template/paseo-plugin.json) |
| Handle conflicts and invalid data | [Drafts and validation](references/drafts.md) | `client/settings-screen.tsx` |

## Workflow

1. Define one versioned `defineSettings` document in `shared/` with defaults.
2. Register it in the server entry and clean up every subscription.
3. Register a settings screen in the client entry.
4. Render `loading`, `invalid`, `error`, and `ready` states explicitly.
5. Capture values and opaque revision together when a draft starts.
6. Save the full document against that captured revision. Preserve both on `false`.
7. Validate, typecheck, test conflicts, then edit settings from two real clients.

## Edge cases

- `save` returns `false` and sets `saveError`; it does not throw.
- Reloading does not discard a component-owned draft.
- Invalid stored data must not be silently reset.
- Documents are host-scoped JSON, not a credential vault.

## Validation

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
cd /absolute/path/to/plugin
npm run typecheck
```

The validator lives in the router skill and requires the complete skills suite. From this skill,
use `../paseo-plugin-authoring/scripts/validate-plugin.mjs`. It is static preflight, not proof of
host compilation.

Exercise first load, successful save, validation failure, stale-revision conflict, reload while a
draft is dirty, explicit discard, reset of invalid data, daemon restart, and a second client.

## Done

- Shared schema defaults produce a complete document.
- All hook states and `saveError` are visible and actionable.
- Failed/conflicting saves preserve draft values and revision.
- Validator, typecheck, tests, and multi-client host QA pass.


Run existing focused tests when present. This minimal template has no `npm test` alias: typechecking is not a behavior test. Before live installation or reload, read [trust and acceptance gates](../paseo-plugin-authoring/references/quality-gates.md). Require authorization, inspect exact runtime ID with `paseo plugin ls <id>` and `paseo plugin logs <id>`, then exercise the contribution.
