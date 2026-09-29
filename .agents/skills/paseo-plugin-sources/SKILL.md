---
name: paseo-plugin-sources
description: Resolve Paseo plugin directory, npm, Git, GitHub and monorepo sources on the daemon host. Use when choosing install identifiers, subdirectory suffixes, runtime IDs, remote hosts, selectors or update behavior.
compatibility: Paseo CLI and access to the intended daemon. Git or npm on daemon PATH for those sources. Install the full authoring skill suite.
---

# Choose plugin sources

| Goal                                    | Read                                     | Template                                     |
| --------------------------------------- | ---------------------------------------- | -------------------------------------------- |
| Resolve source syntax and ambiguities   | [Resolution](references/resolution.md)   | [Source decision](assets/source-decision.md) |
| Update, prepare or target remote daemon | [Acquisition](references/acquisition.md) | [Source decision](assets/source-decision.md) |

1. Record daemon host, source kind, directory within source and intended runtime ID. Read resolution before constructing an identifier.
2. Prefer explicit `npm:`, `github:` or `git:` prefix and absolute daemon paths. Quote selectors containing spaces or comparison operators.
3. Confirm source manifest, range, exact packed files or checkout and preparation. Run shared static validator against local candidate and typecheck it.
4. Read trust gate in [authoring quality gates](../paseo-plugin-authoring/references/quality-gates.md). Install only after authorization, with `paseo --host <url> plugin install <source>` for nondefault host.
5. Use runtime ID from installation for `ls`, logs, reload and removal. Directory edits need reload; updates skip directory sources.

## Check

```bash
node /path/to/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/daemon/plugin
paseo --host <url> plugin ls <runtime-id>
paseo --host <url> plugin logs <runtime-id>
```

Static script requires locally accessible directory and never resolves/downloads a source. See [script contract](../paseo-plugin-authoring/references/scripts.md). No template code needed for source selection. Done when exact source, installed revision, host and ID are confirmed and requested contribution runs.

Gotchas: existing literal directory wins even with colon; `file://` means Git, not local directory; `owner/repo` may be GitHub while `@scope/name` is npm; invalid suffix is retained in identifier; install selectors never pin future updates; same ID rejects without changing existing installation.
