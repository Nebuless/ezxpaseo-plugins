---
name: paseo-plugin-surfaces
description: Build accessible Paseo sidebar surfaces with React Native, host theme tokens, compact layouts, and correct registration cleanup. Use when adding a plugin screen reachable from Paseo's sidebar.
compatibility: Paseo plugin SDK 0.9.2; templates require Node.js and TypeScript for local validation.
---

# Paseo plugin surfaces

Build a sidebar-owned screen that works on desktop, web, iOS, and Android.

| Goal                                | Read                                   | Start from                                    |
| ----------------------------------- | -------------------------------------- | --------------------------------------------- |
| Register a surface and sidebar item | [Surface API](references/surfaces.md)  | [template](assets/template/paseo-plugin.json) |
| Validate and exercise the plugin    | [Validation](references/validation.md) | `assets/template/package.json`                |

## Workflow

1. Copy `assets/template/` outside this skill and choose a lowercase plugin ID.
2. Keep client UI in `client/`, daemon code in `server/`, and shared JSON-safe values in `shared/`.
3. Register the surface before its sidebar item and point `surface` at the exact surface ID.
4. Use React Native primitives, theme colors, compact spacing, and accessibility labels.
5. Return cleanup from the client entry. Remove registrations explicitly when your code owns them.
6. Run the validator, typecheck, tests, then install or reload the plugin for host QA.

## Edge cases

- An unknown surface ID leaves the sidebar item unable to open.
- Unstyled `Text` is unreadable in some themes.
- HTML, DOM globals, and CSS classes break native clients.
- `layout.compact` covers mobile and narrow desktop windows.

## Validation

From the repository root:

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
```

The script lives in the router skill and requires the whole skills suite. From this skill root its
relative path is `../paseo-plugin-authoring/scripts/validate-plugin.mjs`. It is a static preflight,
not proof that Paseo compiled or ran the plugin.

Then run:

```bash
cd /absolute/path/to/plugin
npm run typecheck
```

Open the sidebar screen on a wide client and a compact client, switch light/dark themes, press the
demo control, and confirm reload removes and restores the contribution.

## Done

- The surface opens from its sidebar item.
- Text, backgrounds, spacing, and controls adapt to theme and compact mode.
- Keyboard/screen-reader labels describe the control.
- Static validation, typecheck, tests, and real-host checks pass.

Run existing focused tests when present. This minimal template has no `npm test` alias: typechecking is not a behavior test. Before live installation or reload, read [trust and acceptance gates](../paseo-plugin-authoring/references/quality-gates.md). Require authorization, inspect exact runtime ID with `paseo plugin ls <id>` and `paseo plugin logs <id>`, then exercise the contribution.
