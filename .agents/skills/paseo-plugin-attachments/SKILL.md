---
name: paseo-plugin-attachments
description: Build searchable Paseo composer attachment sources backed by validated plugin RPCs and stable text snapshots. Use when users need to attach local or external resources to agent prompts.
compatibility: Paseo plugin SDK 0.9.2; templates require Node.js and TypeScript for local validation.
---

# Paseo plugin attachments

| Goal                                   | Read                                              | Start from                                    |
| -------------------------------------- | ------------------------------------------------- | --------------------------------------------- |
| Define source, RPC, and search handler | [Attachment contracts](references/attachments.md) | [template](assets/template/paseo-plugin.json) |
| Validate search and composer behavior  | [Validation](references/validation.md)            | `assets/template/package.json`                |

## Workflow

1. Define the typed search RPC and attachment source together in `shared/`.
2. Keep filesystem, credentials, vendor calls, and resource indexing in `server/`.
3. Validate input and output with Zod. Return stable IDs, valid URLs, and complete text snapshots.
4. Register the handler on the server and source on the client.
5. Return cleanup from both entries; never expose secrets in attachment text.
6. Validate, typecheck, test search cases, then attach and submit in a real host.

## Edge cases

- Empty queries should have explicit, bounded behavior.
- Attachment `text` is the full snapshot sent to the agent.
- A slash command cannot run while the composer contains attachments.
- Search output validation rejects malformed URLs or missing fields.

## Validation

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
cd /absolute/path/to/plugin
npm run typecheck
```

The router skill owns the validator; the whole skills suite is required. Its relative path from
this skill is `../paseo-plugin-authoring/scripts/validate-plugin.mjs`. It is static preflight only,
not host compilation.

Search with empty, mixed-case, matching, and nonmatching queries. Attach a result, inspect the
rendered pill, submit it, and confirm the agent receives the documented snapshot without secrets.

## Done

- RPC boundaries validate both directions.
- Search returns stable, complete, safe resources.
- Composer selection and prompt submission work in the host.
- Validator, typecheck, tests, and real-host QA pass.

Run existing focused tests when present. This minimal template has no `npm test` alias: typechecking is not a behavior test. Before live installation or reload, read [trust and acceptance gates](../paseo-plugin-authoring/references/quality-gates.md). Require authorization, inspect exact runtime ID with `paseo plugin ls <id>` and `paseo plugin logs <id>`, then exercise the contribution.
