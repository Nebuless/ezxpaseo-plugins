---
name: paseo-plugin-scaffold
description: Create a Paseo plugin manifest, runtime entries, package configuration and strict TypeScript project. Use when scaffolding a plugin, choosing client/server/shared boundaries, setting compatibility ranges, or selecting dependencies.
compatibility: Paseo 0.9.2 SDK baseline, Node.js 22+, npm and TypeScript. Install the full authoring skill suite.
---

# Scaffold a plugin

| Goal                             | Read                                           | Use                                                |
| -------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| New project                      | [Project contract](references/project.md)      | [Complete template](assets/template/package.json)  |
| Imports, bundles or dependencies | [Runtime boundaries](references/boundaries.md) | [TypeScript config](assets/template/tsconfig.json) |

1. Check daemon/app versions and current docs. Use `paseo plugin init /absolute/path/to/plugin` when available. It writes files, not installed dependencies. Otherwise copy `assets/template/` as a complete server-only lifecycle logger.
2. Rename package and manifest IDs. Keep only needed entries. At least one of `index.client.ts[x]` and `index.server.ts[x]` is required.
3. Put all other modules under `client/`, `server/`, or `shared/`. Classify dependencies before importing, including type imports and transitive imports.
4. Install development dependencies for local checks. Host libraries stay in devDependencies. Third-party server runtime libraries belong in dependencies.
5. Use the focused contribution skill to replace demo logging with requested behavior. Return cleanup for owned resources.

## Check

Read [boundaries](references/boundaries.md) before changing imports. From the plugin directory run `npm run typecheck`. Run suite preflight from any directory:

```bash
node /path/to/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
```

Script is [shared by the suite](../paseo-plugin-authoring/references/scripts.md), not copied into each plugin. Follow [live validation](../paseo-plugin-validation/SKILL.md). Static success is not host-load success.

Missing requirements imply `<0.8.0`. Both daemon and app check their own compatibility, except server-only plugins need no matching client. Paseo treats prereleases by stable core. `>=0.9.2 <0.10.0` is this template's tested baseline, not every API's introduction date. Raise minimum for newer APIs. Done when manifest and imports pass, typecheck passes, and requested entry behavior runs on the intended host.
