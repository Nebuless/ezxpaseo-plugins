---
name: paseo-plugin-panels
description: Build Paseo workspace or agent panels with cached selectors, unavailable states, Explorer placement, and adaptive React Native UI. Use when a plugin needs a tab beside agents, terminals, files, or diffs.
compatibility: Paseo plugin SDK 0.9.2; templates require Node.js and TypeScript for local validation.
---

# Paseo plugin panels

| Goal | Read | Start from |
| --- | --- | --- |
| Choose context, placement, and selectors | [Panel API](references/panels.md) | [template](assets/template/paseo-plugin.json) |
| Prove panel behavior | [Validation](references/validation.md) | `assets/template/package.json` |

## Workflow

1. Copy the template and choose `workspace` or `agent` context.
2. Register `locations: ["workspace", "explorer"]` only when both placements are useful.
3. Read cached records with `useWorkspace(id, selector)` and `useAgent(id, selector)`.
4. Select every rendered field, but never a whole snapshot.
5. Render a clear null state because records can disappear while a restored tab remains.
6. Apply theme colors and compact spacing, return cleanup, then validate and host-test.

## Edge cases

- Selectors are mandatory and compared shallowly.
- Snapshot values are deeply readonly; do not mutate them.
- An agent panel can outlive its cached agent record.
- Do not add an RPC merely to discover the current workspace or agent.

## Validation

From the repository root:

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
```

The validator belongs to the router skill, requires the whole suite, and is located at
`../paseo-plugin-authoring/scripts/validate-plugin.mjs` from this skill root. It is static preflight
only and does not prove host compilation.

```bash
cd /absolute/path/to/plugin
npm run typecheck
```

Open the panel in workspace and Explorer locations, close its agent, restore the tab, resize to a
compact width, and switch themes.

## Done

- The panel opens in each declared location.
- Selectors cover exactly the rendered fields.
- Missing workspace and agent records render safely.
- Typecheck, tests, validator, and real-host QA pass.


Run existing focused tests when present. This minimal template has no `npm test` alias: typechecking is not a behavior test. Before live installation or reload, read [trust and acceptance gates](../paseo-plugin-authoring/references/quality-gates.md). Require authorization, inspect exact runtime ID with `paseo plugin ls <id>` and `paseo plugin logs <id>`, then exercise the contribution.
