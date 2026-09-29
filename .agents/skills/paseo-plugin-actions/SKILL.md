---
name: paseo-plugin-actions
description: Add Paseo Command Center items and client slash commands that reuse one contextual action. Use when users should trigger the same plugin workflow from the command palette and composer.
compatibility: Paseo plugin SDK 0.9.2; templates require Node.js and TypeScript for local validation.
---

# Paseo plugin actions

| Goal | Read | Start from |
| --- | --- | --- |
| Register command and slash entry points | [Action contracts](references/actions.md) | [template](assets/template/paseo-plugin.json) |
| Check collisions and host behavior | [Validation](references/validation.md) | `assets/template/package.json` |

## Workflow

1. Choose `global`, `workspace`, or `agent` context for the Command Center item.
2. Choose `workspace` or `agent` context for the slash command.
3. Extract the shared operation into one typed function instead of duplicating callback logic.
4. Use callback snapshots and capabilities; do not query for the active context.
5. Register any target panel before actions that open it.
6. Return cleanup, run static checks, typecheck, tests, and real-host QA.

## Edge cases

- Built-in commands beat plugin commands; the first plugin in stable catalog order wins plugin collisions.
- Slash commands do not run while the composer has attachments.
- Agent actions are absent without a focused cached agent.
- Unknown panel IDs fail visibly.

## Validation

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
cd /absolute/path/to/plugin
npm run typecheck
```

The validator is owned by the router skill and needs the complete skills suite. From this skill,
use `../paseo-plugin-authoring/scripts/validate-plugin.mjs`. Static preflight cannot verify Paseo
compilation or runtime behavior.

In the host, invoke the item with Ctrl/Cmd+K and submit the slash command with and without arguments.
Confirm both open the same panel. Also verify the slash command is unavailable with an attachment.

## Done

- Both entry points call one shared action.
- Context is supplied by Paseo and the target panel opens.
- Collision and attachment behavior is documented and exercised.
- Validator, typecheck, tests, and host QA pass.


Run existing focused tests when present. This minimal template has no `npm test` alias: typechecking is not a behavior test. Before live installation or reload, read [trust and acceptance gates](../paseo-plugin-authoring/references/quality-gates.md). Require authorization, inspect exact runtime ID with `paseo plugin ls <id>` and `paseo plugin logs <id>`, then exercise the contribution.
