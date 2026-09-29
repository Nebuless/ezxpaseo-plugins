---
name: paseo-plugin-migration
description: Migrate old Paseo mixed plugin entries and outdated composer pill APIs into current runtime-specific entries and button handles. Use for pre-0.8 plugins, removed SDK imports, missing requirements or half-migration load errors.
compatibility: Current Paseo SDK, Node.js 22+ and TypeScript. Install the full authoring skill suite.
---

# Migrate plugin contracts

| Goal | Read | Template |
| --- | --- | --- |
| Old index.ts and suffixed modules | [Entry migration](references/entries.md) | [Migration record](assets/migration-record.md) |
| Old pill component or removed imports | [API changes](references/api-changes.md) | [Migration record](assets/migration-record.md) |

1. Capture existing behavior and tests. Read current migration guide, installed SDK declarations, entries and package versions.
2. Classify modules by runtime. Move code into client/server/shared and default runtime entries, preserving behavior and cleanup. Remove mixed compatibility entry.
3. Move registrations to correct context and update imports, including types. Replace obsolete pill component with button descriptor and callable remover with `.remove()`.
4. Complete migration before declaring new requirements. Pin matching SDK, install tooling, then run static checks and typecheck.
5. Authorized reload exact runtime ID. Inspect `ls` and logs. Exercise every original contribution, including streaming and pending-resource cleanup.

```bash
node /path/to/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
```

Use [script contract](../paseo-plugin-authoring/references/scripts.md) and [validation](../paseo-plugin-validation/SKILL.md). Done when old contract is absent, tests preserve behavior, new entries load, and range matches real daemon/app. A stale SDK can typecheck obsolete code. Adding `>=0.8.0` alone is not migration.
