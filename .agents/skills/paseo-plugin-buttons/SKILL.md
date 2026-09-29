---
name: paseo-plugin-buttons
description: Add Paseo workspace header buttons and agent composer pills with current button descriptors, update handles, and scoped cleanup. Use when plugin actions belong beside a workspace header or composer.
compatibility: Paseo plugin SDK 0.9.2; templates require Node.js and TypeScript for local validation.
---

# Paseo plugin buttons

| Goal | Read | Start from |
| --- | --- | --- |
| Build descriptors and manage handles | [Button contracts](references/buttons.md) | [template](assets/template/paseo-plugin.json) |
| Verify placement and lifecycle | [Validation](references/validation.md) | `assets/template/package.json` |

## Workflow

1. Obtain real `workspaceId` and `agentId` values from panel props or verified cached context.
2. Build a `button` descriptor with accessible `title`, icon, optional label, and behavior.
3. Call `addHeaderButton` or `addComposerPill` for the exact target.
4. Retain the returned `{ update, remove }` handle; it is not a callable remover.
5. Use `update(patch)` for presentation changes and `remove()` during effect cleanup.
6. Validate, typecheck, test, then exercise wide and compact host placements.

## Edge cases

- Duplicate IDs in the same target throw.
- Hiding or disabling closes an open menu/popover but does not cancel an action.
- Updating behavior requires a complete replacement behavior object.
- Updates after removal do nothing; `remove()` is idempotent.

## Validation

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
cd /absolute/path/to/plugin
npm run typecheck
```

The router skill owns the validator and the complete skills suite is required. From this skill the
script is `../paseo-plugin-authoring/scripts/validate-plugin.mjs`. It is static preflight only and
does not prove host compilation.

Open the demo agent panel, verify both placements appear, activate both, resize to compact, then
close the panel and confirm its effect cleanup removes both registrations.

## Done

- Button descriptors use current 0.9.2 shapes.
- Every registration handle is updated/removed through methods.
- Wide, overflow, compact, busy, and cleanup behavior is checked.
- Validator, typecheck, tests, and host QA pass.


Run existing focused tests when present. This minimal template has no `npm test` alias: typechecking is not a behavior test. Before live installation or reload, read [trust and acceptance gates](../paseo-plugin-authoring/references/quality-gates.md). Require authorization, inspect exact runtime ID with `paseo plugin ls <id>` and `paseo plugin logs <id>`, then exercise the contribution.
