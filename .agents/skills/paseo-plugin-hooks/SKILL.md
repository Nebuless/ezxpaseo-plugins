---
name: paseo-plugin-hooks
description: Build and verify Paseo lifecycle and before hooks for environment changes, configuration transforms, follow-ups, cleanup, and permission automation. Use when a plugin must react to agent or workspace events or modify creation and session-open requests.
---

# Paseo plugin hooks

Use hooks for live daemon lifecycle behavior. Hooks are ordered transforms and best-effort events,
not a durable workflow engine.

## Reference index

| Goal                               | Read                              | Template                             |
| ---------------------------------- | --------------------------------- | ------------------------------------ |
| Choose hook and request edits      | [Guide](references/lifecycle.md)  | [Complete template](assets/template) |
| Automate permissions or follow-ups | [Guide](references/automation.md) | [Complete template](assets/template) |

## Read first

- [Hook lifecycle and ordering](references/lifecycle.md)
- [Permissions, follow-ups, and races](references/automation.md)
- Copyable implementation: [assets/template](assets/template)
- Suite validator: [../paseo-plugin-authoring/scripts/validate-plugin.mjs](../paseo-plugin-authoring/scripts/validate-plugin.mjs)

## Workflow

1. Choose `server.before()` for request transformation or `server.on()` for observation and action.
2. Return a new request. Preserve nested values explicitly because Paseo does not deep-merge.
3. Use `agent.session_open` for create, resume, refresh, and import launch environment changes.
4. Check `purpose`; skip `"history"` unless history sessions genuinely need the injected value.
5. Pass `context.signal` to cancellable external work. Every hook is limited to 30 seconds.
6. Make event handlers concurrency-safe. Add idempotency state before awaiting side effects.
7. Treat permission response as a race with the user and other plugins; an already-resolved response
   rejects.
8. Bound automated follow-ups per agent and turn. Do not build retry loops from live events.
9. Keep every remover and return cleanup from the server entry.
10. Validate from the suite root, then typecheck, test, reload, inspect, and exercise:

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
cd /absolute/path/to/plugin
npm install
npm run typecheck
npm test
```

The validator is static preflight, not proof of hook order, daemon status, or real lifecycle
behavior. Install this skill together with the sibling `paseo-plugin-authoring` suite.

## Edge cases

- Before hooks run by plugin ID, then registration order inside each plugin.
- `undefined` preserves the request. Invalid output or a thrown error fails the operation.
- Environment maps are launch overrides. Spread `request.env` to merge; omission replaces it.
- Events are live, best effort, concurrent, and never replayed, persisted, or retried.
- Permission requests include tool, plan, question, mode, and other kinds. Match only understood
  shapes.
- Follow-up sends start new turns. Attachments and tool effects are not replayed.
- Plugin stop aborts hook signals and removes remaining registrations.

## Done gate

- Request transforms preserve all unrelated fields.
- History-purpose behavior is intentional and tested.
- Permission matching handles only a documented request type.
- Follow-ups are bounded and concurrency-safe.
- Cleanup removes every explicit registration.
- Typecheck, tests, real reload, status, logs, and one real hook trigger pass.

Before live reload or installation, read [trust gates](../paseo-plugin-authoring/references/quality-gates.md). Obtain authorization, then reload the exact runtime ID, inspect `paseo plugin ls <runtime-id>` and `paseo plugin logs <runtime-id>`, and exercise the behavior.
