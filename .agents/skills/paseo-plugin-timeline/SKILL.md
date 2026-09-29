---
name: paseo-plugin-timeline
description: Transform and render Paseo agent timeline items with deterministic client logic, versioned Zod schemas, streaming support, and optional daemon appends. Use when replacing built-in rows or adding plugin-owned timeline output.
compatibility: Paseo plugin SDK 0.9.2; templates require Node.js and TypeScript for local validation.
---

# Paseo plugin timeline

| Goal | Read | Start from |
| --- | --- | --- |
| Transform and render native rows | [Transformers and renderers](references/timeline-rendering.md) | [template](assets/template/paseo-plugin.json) |
| Append plugin rows from the daemon | [Daemon append](references/timeline-append.md) | renderer schema in the template |

## Workflow

1. Select one stable built-in `itemType`.
2. Keep the transformer synchronous, deterministic, and JSON-only.
3. Return `undefined` to keep the native row, `{ items: [] }` to remove it, or replacements.
4. Give each replacement a stable `kind`, positive `version`, and schema-valid `data`.
5. Register a renderer for the exact kind/version and handle streaming phase.
6. Return cleanup, validate, typecheck, test, then observe a live streaming turn.

## Edge cases

- Transformers run on history and every streaming update.
- A thrown transformer is logged and skipped.
- Renderer schema failures show an unavailable row.
- One source producing multiple rows needs explicit stable output IDs.

## Validation

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
cd /absolute/path/to/plugin
npm run typecheck
```

The validator is in the router skill, requires the whole suite, and is reachable from this skill as
`../paseo-plugin-authoring/scripts/validate-plugin.mjs`. It is static preflight, not host
compilation.

Run an agent turn that emits reasoning. Watch the row while streaming and after completion, refetch
history, reload the plugin, and test the unavailable-renderer state in a disposable install.

## Done

- Transform output is deterministic and schema-valid.
- Streaming preserves row identity and uses the phase.
- Optional append constraints are understood before server use.
- Validator, typecheck, tests, and live timeline QA pass.


Run existing focused tests when present. This minimal template has no `npm test` alias: typechecking is not a behavior test. Before live installation or reload, read [trust and acceptance gates](../paseo-plugin-authoring/references/quality-gates.md). Require authorization, inspect exact runtime ID with `paseo plugin ls <id>` and `paseo plugin logs <id>`, then exercise the contribution.
