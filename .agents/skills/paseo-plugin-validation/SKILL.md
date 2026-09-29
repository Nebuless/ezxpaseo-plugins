---
name: paseo-plugin-validation
description: Validate Paseo plugin source, runtime imports, schemas, templates and live contributions, and diagnose load failures. Use before plugin handoff, install or reload, or when typechecking passes but host loading or UI behavior fails.
compatibility: Node.js 22+, npm, local plugin dependencies and access to the intended Paseo host for live QA. Install the full authoring skill suite.
---

# Validate custom plugins

| Goal                                  | Read                                        | Template                         |
| ------------------------------------- | ------------------------------------------- | -------------------------------- |
| Static checks and behavior acceptance | [Check matrix](references/check-matrix.md)  | [QA record](assets/qa-record.md) |
| Reload, RPC, module or UI failure     | [Failure diagnosis](references/failures.md) | [QA record](assets/qa-record.md) |

1. Read current manifest, package, entries, tests and SDK version. Reproduce failure before editing existing behavior.
2. Run shared validator with exact runtime versions, then `npm run typecheck` and focused tests from plugin directory. Inspect every diagnostic. Warnings identify checks still requiring judgment.
3. Verify artifact content for distributed plugins. Review inputs/outputs at RPC and external-data boundaries, cleanup on reload/disconnect, and async race behavior.
4. Obtain authorization for live changes. Install/reload exact ID on intended host, require running without error, inspect logs, exercise real action and error case.
5. For client contributions view wide and compact, light and dark. Verify missing records, offline host, pending state, accessibility and cleanup. For timeline inspect streaming, not only completed rows.

```bash
node /path/to/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin --daemon-version 0.9.2 --client-version 0.9.2 --json
node /path/to/paseo-plugin-authoring/scripts/validate-skills.mjs /absolute/path/to/skills
node /path/to/paseo-plugin-authoring/scripts/verify-templates.mjs /absolute/path/to/skills
```

Read [script contract](../paseo-plugin-authoring/references/scripts.md) for dependencies, exit codes and limitations. Versions shown are examples: pass observed versions. Skills validator checks suite, not plugin. Templates checker checks bundled examples, not arbitrary production project.

Done when behavior is observed through real surface, relevant checks pass, and unrun checks have exact reasons. Never use static success as authorization or claim host load from an offline bundle.
