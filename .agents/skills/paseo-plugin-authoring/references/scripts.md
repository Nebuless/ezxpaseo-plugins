# Validator contracts

Node.js 22+. Required installed modules: `yaml`, `semver`, `typescript`, `esbuild`. Repository already supplies them. A standalone copy can run `npm install --prefix /path/to/paseo-plugin-authoring/scripts`. No global CLI or network needed afterward.

| Script | Input | Success | Failure | Side effects |
| --- | --- | --- | --- | --- |
| `scripts/validate-skills.mjs` | Suite directory, or one skill directory | Exit 0, skill count | Exit 1, path and reason | None |
| `scripts/validate-plugin.mjs` | Plugin directory; optional runtime versions and `--json` | Exit 0, diagnostics | Exit 1, errors; warnings do not imply failure | None; no source execution |
| `scripts/verify-templates.mjs` | Suite or one skill directory | Exit 0, every selected template checked | Exit 1, per-template compiler/bundle/pack errors | npm dry-run may write npm cache/logs, no tarball or build output |
| `scripts/validators.test.mjs` | `node --test <path>` | Passing TAP and exit 0 | Assertion or CLI exit mismatch | Isolated OS temp fixtures, removed in `finally` |

`validate-plugin` reads strict JSON manifest/package, TypeScript configuration and reachable code. AST import checks include exports, type imports, static `require`, dynamic imports, and TypeScript aliases. Non-literal imports cannot be proven safe and are rejected. Client host module specifiers must match exactly. Shared modules cannot import client/server/Node/runtime types. Declaration files are part of those boundaries. Obvious DOM usage and lib contamination are errors. This is conservative preflight, not Paseo's compiler or a full security/accessibility audit.

Runtime version options apply Paseo's documented stable-core treatment to prereleases. Missing requirements are treated as `<0.8.0` but reported as an authoring error. Without version options the script cannot establish compatibility with a real daemon/app. Client check is skipped for server-only plugins.

Skill metadata is parsed with YAML rather than regular expressions. Validator checks names, lengths, allowed fields, string metadata, body, and relative Markdown links. It does not grade prose or prove agent activation quality. The official independent check is `skills-ref validate <skill-directory>` from https://agentskills.io/specification.

`verify-templates` checks directories named `assets/template` in the suite. It uses dependencies resolvable from each template or the repository. Install a newer SDK in its own template directory when required. A 0.9.3 template must not silently typecheck against 0.9.2. Host modules are external during in-memory bundles. Pack checks use `npm pack --dry-run --json --ignore-scripts`: lifecycle scripts do not run.

Adjacent `*.test.*` and `*.spec.*` modules are not runtime code, so Node imports there are allowed. A runtime import of test code is an error. Non-test declaration files remain audited. Run `node --test scripts/templates.test.mjs` for deterministic attachment/settings/schema/hook behavior checks.
