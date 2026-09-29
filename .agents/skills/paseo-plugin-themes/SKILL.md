---
name: paseo-plugin-themes
description: Contribute Paseo light or dark palettes with valid hex colors, stable IDs, cleanup, and appearance QA. Use when adding a selectable plugin theme under Settings > Appearance.
compatibility: Paseo plugin SDK 0.9.2; templates require Node.js and TypeScript for local validation.
---

# Paseo plugin themes

| Goal | Read | Start from |
| --- | --- | --- |
| Define and register a palette | [Theme contract](references/themes.md) | [template](assets/template/paseo-plugin.json) |
| Check contrast and fallback | [Validation](references/validation.md) | `assets/template/package.json` |

## Workflow

1. Choose one stable lowercase theme ID, name, and `light` or `dark` appearance.
2. Supply the compact palette with valid hex strings.
3. Register it with `addTheme` and return cleanup.
4. Keep hardcoded colors inside palette data only; UI components use host theme tokens.
5. Validate and typecheck, then select the theme in a real client.
6. Inspect core surfaces, terminal, diffs, statuses, focus rings, and plugin removal fallback.

## Edge cases

- Non-hex values fail to load.
- A pre-theme client reports `client.addTheme is not a function`.
- Removing the active theme falls back to the default.
- Only one contributed theme is active at a time.

## Validation

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
cd /absolute/path/to/plugin
npm run typecheck
```

The validator lives in the router skill and requires the whole suite. Its path from this skill is
`../paseo-plugin-authoring/scripts/validate-plugin.mjs`. Static preflight does not prove that the
host derived readable colors.

Select the theme under Settings > Appearance. Inspect a workspace, menus, controls, diffs,
terminal, success/warning/error states, and focus rings; then disable the plugin and confirm fallback.

## Done

- Palette data is valid and registered with cleanup.
- UI code contains no copied palette colors.
- Selection, persistence, and removal fallback work in the host.
- Validator, typecheck, tests, and visual host QA pass.


Run existing focused tests when present. This minimal template has no `npm test` alias: typechecking is not a behavior test. Before live installation or reload, read [trust and acceptance gates](../paseo-plugin-authoring/references/quality-gates.md). Require authorization, inspect exact runtime ID with `paseo plugin ls <id>` and `paseo plugin logs <id>`, then exercise the contribution.
