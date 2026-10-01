---
name: paseo-plugin-publishing
description: Prepare and validate Paseo plugin npm artifacts or Git sources, including assets, dependencies and build commands. Use when packaging, publishing, sharing a monorepo plugin or handling private registries and native setup.
compatibility: Node.js 22+, npm and Git as required. Publishing credentials belong to the publishing host. Install the full authoring skill suite.
---

# Package a plugin

| Goal                                | Read                                     | Template                                   |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------ |
| npm package files and dependencies  | [npm artifacts](references/npm.md)       | [Release checks](assets/release-checks.md) |
| Git preparation or private registry | [Preparation](references/preparation.md) | [Release checks](assets/release-checks.md) |

1. Start from working plugin and verified behavior. Read source and dependencies, then choose npm or Git distribution.
2. For npm, set publishable name/version and remove `private` only in intended release package. Include source entries/runtime directories and extra assets in `files`. Keep host libraries as devDependencies.
3. For Git, commit lockfile when installing server dependencies and declare direct preparation argv. Do not assume lockfile automatically runs installation.
4. Run preflight, typecheck, tests and `npm pack --dry-run --json --ignore-scripts`. Inspect actual file list, not package.json alone. Exclude credentials, logs and fixtures not needed at runtime.
5. Publishing, pushing, or installing released artifacts is an external write. Obtain authorization, publish exact reviewed artifact, then verify it on intended daemon with source skill.

## Check

```bash
node /path/to/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
npm run typecheck
npm pack --dry-run --json --ignore-scripts
```

Run npm commands inside plugin. Validator [contract](../paseo-plugin-authoring/references/scripts.md) does not publish. Done when packed content includes every runtime file/asset, installation behavior is verified, and authorized release has exact version/source recorded. If publication was not requested, stop at validated package.

Gotchas: installation ignores lifecycle scripts; generated files must already be included; provider/usage SVG outside runtime dirs needs explicit pack inclusion; npm name and plugin ID differ; registry authentication happens on daemon, not app; selectors do not constrain updates.
