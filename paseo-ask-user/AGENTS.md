# Ask-user plugin ownership

This plugin contributes a Paseo timeline card and agent ask-user MCP tool. Read root `../AGENTS.md` for worktree, review, quality and release rules. Entry points are `index.server.ts` and `index.client.tsx`; `paseo-plugin.json` requires Paseo `>=0.9.2`.

## Where to look

| Change                                           | Files / checks                                                 |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Agent creation, session hooks, RPC, cleanup      | `index.server.ts`, `server/question-broker.test.mjs`           |
| Loopback broker, token checks, pending questions | `server/question-broker.ts`, `server/question-broker.test.mjs` |
| Bundled stdio MCP tool                           | `server/mcp-server-source.mjs`, `server/mcp-server.test.mjs`   |
| Shared question/answer validation and RPC        | `shared/ask-schema.mjs`, `shared/ask-user.ts`                  |
| Timeline card and input handling                 | `index.client.tsx`, `client/ask-user-card.tsx`                 |

## Local contracts

- `index.server.ts` registers before hooks, archive handling and RPC; its cleanup removes registrations and closes broker. Do not inject MCP into internal agents. Preserve existing `mcpServers` entries and reject a name collision instead of overwriting one.
- `QuestionBroker` listens on loopback, issues scoped tokens per agent and unregisters them on archive; prevent another agent's token from answering or cancelling a pending question. Timeouts and broker shutdown must settle pending calls. Never log tokens or expose broker to external interfaces.
- MCP helper source is embedded into `node --eval`: never assume the agent process resolves plugin-local `node_modules` or source-relative paths. Respect MCP JSON-RPC framing, bounded input and explicit errors; test protocol via real stdio client.
- Shared Zod schemas define cross-runtime payloads and timeline version. Keep server output, client renderer and answer RPC aligned; preserve user-visible answer modes unless asked to change them.
- `client/ask-user-card.tsx` owns accessible controls and pending/completed state. UI tests or real app checks must exercise user submission, cancellation and stale state; typecheck alone does not prove rendering.

## Verification

From repository root:

```bash
npm run typecheck --workspace=paseo-ask-user
npm run test --workspace=paseo-ask-user
npm run format:check --workspace=paseo-ask-user
```

These checks are local and safe. Installing, enabling or reloading the plugin on a daemon requires explicit approval and a separate runtime check.
