# EZXPaseo plugin repository

Project guidance for agents. Generated from clean `main` commit `936234d`: one TypeScript Paseo plugin, `paseo-ask-user`. Read actual source and tests before relying on a planning document. Child `AGENTS.md` adds domain rules without replacing this workflow.

## Where to look

| Goal                                                | Owner                                                                                     |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Plugin manifest, SDK compatibility, runtime entries | `paseo-ask-user/paseo-plugin.json`, `package.json`, `index.server.ts`, `index.client.tsx` |
| Broker, MCP helper, protocol                        | `paseo-ask-user/server/`                                                                  |
| Schemas and RPC shared by both runtimes             | `paseo-ask-user/shared/`                                                                  |
| Timeline UI                                         | `paseo-ask-user/client/`                                                                  |
| Repository workflow and release steps               | `docs/repository-workflow.md`, `docs/releasing.md`                                        |
| User-facing plugin behavior                         | `paseo-ask-user/AGENTS.md`, nearby tests                                                  |

Other plugins added later should own their own manifest, package commands, and scoped guidance. Do not assume uncommitted work from another worktree exists here.

## Before every change

1. Inspect `git status --short --branch`, `wt list`, relevant package README, nearest `AGENTS.md`, code and tests. Preserve unrelated user or agent changes.
2. In the coordinating checkout, write or select a reviewable plan file (`docs/plans/<change>.md`) or OpenSpec change proposal with scope and acceptance. This requirement applies to features, fixes, refactors, updates, documentation and maintenance. A plan is authorization to scope work, not to merge or deploy.
3. Use Worktrunk to create **one branch and one dedicated worktree per change** from the latest available `main`: `wt switch --create <type>/<short-name> --base main --no-cd --format json`. Record returned path; dispatch an agent to that worktree with plan path, boundaries, acceptance checks and stop condition. If host already placed you in a dedicated worktree, use it; do not nest another.
4. Agent reads plan and nearest guidance in its worktree, works there, verifies, and reports diff plus evidence to coordinator. Main agent checks results and handles integration only on explicit request. Never write feature code directly in the primary checkout or `main`, reuse another task's worktree, or run raw `git worktree` commands.

`main` must stay clean and releasable: no direct development, experimental commits, unrelated file changes, or unverified integration. If primary checkout is on a non-main dirty branch, leave its changes alone and branch from clean `main` in a separate Worktrunk tree. Without a remote, use local `main`; after adding one, fetch and verify the remote base before integration. Never reset, clean, force-push, or silently move someone else's changes. Read [worktree and dispatch procedure](docs/repository-workflow.md).

Worktree handoff evidence names branch, absolute worktree path, plan/proposal path, affected packages, and actual checks. A plan not committed into the branch must be readable by the worker at the coordinating checkout path. Keep isolation even when work spans client and server: one coherent change can touch both, but two independent changes need two worktrees. Worktrunk hooks cannot prove a plan was written or that an agent was dispatched; coordinator must inspect that handoff.

## Coding and verification

- This is a trusted Paseo plugin, not the Paseo host. Keep client UI, daemon hooks/RPC, and shared schemas in their own runtimes; test auth, lifecycle cleanup, and async cancellation when they change.
- Node.js 22+, npm workspaces. `npm ci` from the worktree root for a clean dependency install. `npm run check` runs workspace Prettier, TypeScript and tests. `npm run quality` runs QLTY on all files without fixes. Prefer focused workspace checks while coding; run both before review.
- `wt` project config at `.config/wt.toml` runs those checks and committed-message lint on a merge attempt. Worktrunk project command approval is per machine; do not bypass checks by approving unknown hooks. Test what changed; never report an unrun live plugin load as passing.
- Inspect scope with `git diff --check` and `git status --short`. Never stage another worktree's edits or include credentials, local broker tokens, QLTY caches, generated artifacts, or `node_modules`.

## Commits and releases

- Use Conventional Commits: `feat(scope): summary`, `fix(scope): summary`, `docs(scope): summary`, `chore(scope): summary`; use `!` or `BREAKING CHANGE:` for incompatible behavior. `npm run commitlint` validates a message. Version and release notes derive from committed history; `npm run changelog` regenerates `CHANGELOG.md` for release review. See `docs/releasing.md`.
- Worktrunk's default squash and auto-commit can bypass reviewed commit history. For an explicitly authorized local integration, first commit only reviewed files, then use `wt merge --no-commit --no-squash`; its pre-merge checks still run. Do not call plain `wt merge`.
- Do not commit, push, merge, tag, publish, enable plugins, or edit a user's running Paseo daemon unless explicitly requested. Local hooks are advisory, not proof that remote `main` is protected; require review and checks before authorized integration.

## Scoped guidance

- `paseo-ask-user/AGENTS.md` owns broker, MCP and timeline invariants.
- `docs/` owns durable plans, repository workflow and release documents; root rules apply there.

When structure, verification commands, or ownership change, update the closest guidance and affected parent references in the same change. Keep this file concise and current; source, manifests and tests are behavior evidence, not this policy's claims.
