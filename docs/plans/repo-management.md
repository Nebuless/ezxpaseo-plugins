# Repository management setup

Status: implementation plan. Source: current clean `main` at `936234d`.

## Scope

- Keep the primary checkout for coordination; create a dedicated Worktrunk branch and worktree before changes. This task uses `chore/repo-management` at the sibling checkout.
- Generate concise root and plugin-local `AGENTS.md` guidance using init-deep's small-repository inline route; adapt PI-Desktop's policy hierarchy and verification discipline, not its Electron architecture or PR gates.
- Configure QLTY CLI for this TypeScript/Paseo plugin workspace, Conventional Commit validation, and a reproducible conventional changelog command. Describe release versioning without publishing or tagging.
- Document mandatory plan/proposal before a fresh worktree and agent dispatch for each feature, fix, update, or change. No automatic commit, push, merge, installation, or cleanup of another task's worktree.

## Acceptance

1. No edits to original `fix/omp-chat-mcp-hook` checkout; this branch starts from clean `main`.
2. `AGENTS.md` accurately routes plugin entry points, shared contracts, tests and worktree policy; plugin-local file owns broker/MCP details without duplicating root.
3. Worktrunk project config parses; QLTY check runs or records an exact environment blocker; commit messages and changelog generator have positive/negative runnable checks.
4. Workspace checks and manual path audits run on this branch. Docs never claim existing dirty feature work is already on `main`.
