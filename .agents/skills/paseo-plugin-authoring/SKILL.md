---
name: paseo-plugin-authoring
description: Decompose Paseo plugin creation into focused authoring skills, select contributions, and define quality gates. Use when starting a custom Paseo plugin, combining multiple contributions, or choosing references, templates, and validation scripts.
compatibility: Paseo plugins. Node.js 22+ and npm for scripts and templates. Network access for current Paseo docs. Install this skill suite together.
---

# Paseo plugin authoring

Expand the existing `paseo-plugin` workflow, not its stale examples. Read only resources matching the requested goal. Paths below resolve from this skill directory, not the plugin directory.

## Route the goal

| Need                                   | Read first                                         | Then load                                                                                                                                       |
| -------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| New plugin or several contributions    | [Contribution map](references/contribution-map.md) | [Scaffold](../paseo-plugin-scaffold/SKILL.md)                                                                                                   |
| Screens, navigation, panel context     | [Contribution map](references/contribution-map.md) | [Surfaces](../paseo-plugin-surfaces/SKILL.md), [panels](../paseo-plugin-panels/SKILL.md)                                                        |
| Composer or workspace actions          | [Contribution map](references/contribution-map.md) | [Actions](../paseo-plugin-actions/SKILL.md), [buttons](../paseo-plugin-buttons/SKILL.md)                                                        |
| Custom conversation UI                 | [Quality gates](references/quality-gates.md)       | [Timeline](../paseo-plugin-timeline/SKILL.md)                                                                                                   |
| External resource attachment           | [Contribution map](references/contribution-map.md) | [Attachments](../paseo-plugin-attachments/SKILL.md), [RPC](../paseo-plugin-rpc/SKILL.md)                                                        |
| Persistent configuration or palette    | [Quality gates](references/quality-gates.md)       | [Settings](../paseo-plugin-settings/SKILL.md), [themes](../paseo-plugin-themes/SKILL.md)                                                        |
| Configuration, permissions, follow-ups | [Quality gates](references/quality-gates.md)       | [Hooks](../paseo-plugin-hooks/SKILL.md), [MCP](../paseo-plugin-mcp/SKILL.md)                                                                    |
| New coding agent or quota integration  | [Contribution map](references/contribution-map.md) | [Providers](../paseo-plugin-providers/SKILL.md), [usage](../paseo-plugin-usage/SKILL.md)                                                        |
| Remote hosts or SDK operations         | [Quality gates](references/quality-gates.md)       | [Hosts](../paseo-plugin-hosts/SKILL.md)                                                                                                         |
| Installation, release or older plugin  | [Quality gates](references/quality-gates.md)       | [Sources](../paseo-plugin-sources/SKILL.md), [publishing](../paseo-plugin-publishing/SKILL.md), [migration](../paseo-plugin-migration/SKILL.md) |
| Failure diagnosis or final acceptance  | [Quality gates](references/quality-gates.md)       | [Validation](../paseo-plugin-validation/SKILL.md)                                                                                               |

## Workflow

1. Read the contribution map. Record target daemon, app versions, plugin source, runtime ID, selected host, and requested behavior using [acceptance template](assets/acceptance.md).
2. Fetch `https://paseo.sh/llms.txt`, then current plugin reference and relevant publishing/provider/migration pages. Deployed docs override bundled examples. Offline work must label version-sensitive claims unverified.
3. Load scaffold plus only the focused skills required. Prefer `usePaseo()` or handler `{ paseo }` for normal operations. Add RPC only for plugin-specific backend work.
4. Copy one complete template as a base. Merge other contributions into its entries, retaining runtime directories, cleanup, schemas, and matching SDK versions. Do not install every example or add features the user did not request.
5. Run static preflight, typecheck, focused tests, and real host acceptance. Fix failures before handoff. Read quality gates before any install or live mutation.

## Scripts

Read [script contract](references/scripts.md) before running any script. All commands are read-only checks except temporary files created by regression tests, which are removed afterward.

```bash
node /absolute/path/to/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
node /absolute/path/to/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin --daemon-version 0.9.2 --client-version 0.9.2 --json
node /absolute/path/to/paseo-plugin-authoring/scripts/validate-skills.mjs /absolute/path/to/skills
node /absolute/path/to/paseo-plugin-authoring/scripts/verify-templates.mjs /absolute/path/to/skills
```

`validate-plugin` performs static checks. `validate-skills` validates YAML, metadata and local links. `verify-templates` typechecks, bundles in memory with host externals, and checks npm dry-run contents. None proves a live plugin works.

## Gotchas and completion

- Pill/header registration returns `{ update, remove }`, unlike ordinary callable removers.
- Missing `requirements.paseo` means `<0.8.0`, not unrestricted compatibility. Prereleases are compared using their stable core by Paseo.
- Daemon compatibility does not imply app compatibility. Usage sources need 0.9.3, beyond this repo's 0.9.2 SDK.
- Reload failure does not restore the previous local bundle. Managed update failure retains the previous installation.

Done when requested behavior has an observed result, static and type checks pass, cleanup/error cases are exercised, and unrun live checks are explicitly reported. Use [acceptance template](assets/acceptance.md) as evidence, not as a substitute for execution.
