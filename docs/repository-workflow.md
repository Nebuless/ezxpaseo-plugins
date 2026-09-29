# Change workflow

The primary checkout coordinates changes; clean `main` remains a release candidate. `wt` owns linked worktree creation, switching and removal. No remote is configured in this checkout yet, so use local `main` until a remote exists.

## From request to agent

1. Confirm `git status --short --branch` and `wt list`. Leave existing dirty work or another agent's worktree untouched.
2. Main agent writes a plan at `docs/plans/<change>.md` or an OpenSpec proposal with requested behavior, boundaries and acceptance checks. Plan stays in the coordinating checkout until committed, or is passed as an absolute readable path to the worker; a newly branched worktree does **not** inherit uncommitted plans. Do not copy uncommitted code across worktrees as an implicit dependency.
3. Create a new worktree from local clean `main`:

   ```sh
   wt switch --create fix/question-state --base main --no-cd --format json
   ```

   Use `feat/`, `fix/`, `docs/`, `chore/` or `refactor/` plus a short unique name. With a remote, fetch and check current base first. Worktrunk reports path and branch; no shell `cd` is assumed in agent API sessions. Check `wt config approvals list` before unattended hooks.

4. Dispatch one agent into returned path with plan path/content, file scope, tests, and evidence required. The worker first reads the plan, root and nearest `AGENTS.md`. It works in **that** worktree and reports evidence. Independent changes get separate plans and worktrees; never reuse an in-progress tree.
5. Coordinator reviews diff and actually checks tests. Before authorized integration verify base freshness, branch state, relevant checks and no unrelated files. Worktrunk project config cannot set its merge defaults. **Do not run plain `wt merge`**: it stages uncommitted files and squashes by default. After explicit authorization and reviewed commits, `wt merge --no-commit --no-squash` preserves messages, runs the pre-merge checks, and may still rebase, move `main`, and remove the worktree. Run it only when those exact effects are authorized, not as routine validation. If using PR-based integration later, merge through the reviewed PR and sync local `main`, never use local main for temporary integration.

Uncommitted or ignored plans are still valid handoff artifacts but cannot be assumed to travel with a branch. For OpenSpec, an ignored `openspec/` directory may contain local artifacts; pass their path explicitly and keep the plan accessible while the worker runs. Never perform raw `git worktree` mutations or delete another agent's branch.

## Gate and limits

- Run `npm run check`, `npm run quality` and `npm run commits:check` in task worktree, then inspect diff. `.config/wt.toml` repeats all three in a `pre-merge` hook; it is a backstop, not permission to merge.
- `wt config show` validates project config. `qlty config validate` checks `.qlty/qlty.toml`; QLTY may fetch its pinned tool plugins on first run. `npm run quality` uses `--no-fix` so checks do not rewrite files.
- Worktrunk cannot enforce plan-first or agent dispatch by itself. This policy is an agent contract; coordinator checks evidence and ensures returned worktree path belongs to the task.
- In this checkout `main` is another branch at `936234d`, but the primary checkout currently contains unrelated dirty `fix/omp-chat-mcp-hook` work. Do not switch it to `main` or absorb those edits to satisfy cleanliness.
