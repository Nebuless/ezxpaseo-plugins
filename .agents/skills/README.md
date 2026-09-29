# Paseo plugin authoring skills

Start with [paseo-plugin-authoring](paseo-plugin-authoring/SKILL.md). It routes a goal to a focused skill rather than loading the entire API reference.

Install this whole directory into your agent's skill discovery directory. Each child directory is one Agent Skill. Keep the directories together: focused skills use the authoring skill's validation scripts. Do not replace the globally installed `paseo-plugin` skill automatically. This suite expands it with current contracts, examples, and checks.

This repository's `.pi/skills` and `.omp/skills` also contain unrelated OpenSpec skills. Copy or link these `paseo-plugin-*` directories there if your agent uses those discovery paths. Generic consumers can use their own Agent Skills directory.

## Scope

| Goal | Skill |
| --- | --- |
| Choose contributions and verification gates | [Authoring](paseo-plugin-authoring/SKILL.md) |
| Create entries, manifest, dependencies and runtime boundaries | [Scaffold](paseo-plugin-scaffold/SKILL.md) |
| Resolve local, npm, Git, monorepo and remote-host sources | [Sources](paseo-plugin-sources/SKILL.md) |
| Surface and sidebar navigation | [Surfaces](paseo-plugin-surfaces/SKILL.md) |
| Workspace, agent and Explorer panels | [Panels](paseo-plugin-panels/SKILL.md) |
| Command Center and composer slash actions | [Actions](paseo-plugin-actions/SKILL.md) |
| Header buttons, menus, popovers and composer pills | [Buttons](paseo-plugin-buttons/SKILL.md) |
| Timeline transformation, rendering and append | [Timeline](paseo-plugin-timeline/SKILL.md) |
| Searchable composer attachments | [Attachments](paseo-plugin-attachments/SKILL.md) |
| Persisted settings, migrations and revision conflicts | [Settings](paseo-plugin-settings/SKILL.md) |
| Light/dark theme palettes | [Themes](paseo-plugin-themes/SKILL.md) |
| Shared contracts and backend RPC | [RPC](paseo-plugin-rpc/SKILL.md) |
| Lifecycle, before hooks, permissions and follow-ups | [Hooks](paseo-plugin-hooks/SKILL.md) |
| MCP injection and subprocess helpers | [MCP](paseo-plugin-mcp/SKILL.md) |
| Direct provider protocol and ACP adapters | [Providers](paseo-plugin-providers/SKILL.md) |
| Account identity and usage reporting, Paseo 0.9.3+ | [Usage](paseo-plugin-usage/SKILL.md) |
| Selected-host SDK calls and explicit cross-host access | [Hosts](paseo-plugin-hosts/SKILL.md) |
| npm artifacts and Git preparation | [Publishing](paseo-plugin-publishing/SKILL.md) |
| Old mixed entries and changed button contracts | [Migration](paseo-plugin-migration/SKILL.md) |
| Static checks, host QA and load-failure diagnosis | [Validation](paseo-plugin-validation/SKILL.md) |

## Local verification

Node.js 22+ required. Scripts use `yaml`, `semver`, `typescript`, and `esbuild`, already installed in this repository. Outside it, run `npm install --prefix .agents/skills/paseo-plugin-authoring/scripts` first. Scripts never install, enable, reload, publish, or execute a plugin.

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-skills.mjs .agents/skills
node --test .agents/skills/paseo-plugin-authoring/scripts/*.test.mjs
for skill in .agents/skills/paseo-plugin-*; do
  [ "$skill" = .agents/skills/paseo-plugin-usage ] && continue
  [ -d "$skill/assets/template" ] && node .agents/skills/paseo-plugin-authoring/scripts/verify-templates.mjs "$skill"
done
```

Templates are complete small examples, not production vendor integrations. Copy one template directory outside `.agents/skills/`, adapt its behavior, and install its dependencies. Standard templates target the repository's SDK 0.9.2, not an asserted API introduction version. Usage sources require their own 0.9.3 SDK. Neither successful TypeScript checking nor an offline bundle proves the real app's loader accepts a plugin. Follow the validation skill for that final check.

The usage template is a documented future-runtime example: `@getpaseo/plugin@0.9.3` is not published as of 2026-09-29, and installed daemon is 0.9.2. Its local calculation tests run, but full SDK checking and live activation are blocked. Running `verify-templates.mjs .agents/skills` deliberately reports that mismatch as failure rather than silently skipping it. Recheck registry before adopting it.

Contracts checked on 2026-09-29 against [Paseo reference](https://paseo.sh/docs/plugins/reference), [publishing](https://paseo.sh/docs/plugins/publishing), [providers](https://paseo.sh/docs/plugins/providers), [migration](https://paseo.sh/docs/plugins/migration), and [Agent Skills specification](https://agentskills.io/specification). Earlier installed skill examples differ from current button and prerelease contracts. Recheck deployed docs before adopting new APIs.
