# Permission and follow-up automation

Checked 2026-09-29.

Sources:

- Paseo plugin reference, permission requests:
  https://paseo.sh/docs/plugins/reference.md#answer-a-permission-request
- Paseo plugin reference, follow-ups:
  https://paseo.sh/docs/plugins/reference.md#send-a-follow-up-when-a-turn-ends
- Paseo plugin reference, hook context and cleanup:
  https://paseo.sh/docs/plugins/reference.md#context-and-cleanup

## Permission requests

Requests have `kind` values `tool`, `plan`, `question`, `mode`, or `other`. Shell matching must first
require `request.kind === "tool"` and `request.detail?.type === "shell"`.

Respond with the existing SDK:

```ts
await context.paseo.agents.ref(agentId).respondToPermission({
  requestId,
  response: { behavior: "deny", message: "Policy explanation." },
});
```

The user or another plugin may resolve the request first. The SDK call then rejects. Let the event
handler report that failure in plugin logs; do not retry a stale permission response.

## Follow-ups

`agent.turn_ended` includes the complete timeline snapshot. Events can overlap and are not replayed.
Add an idempotency key before awaiting `agent.send()`. Bound retained keys and the number of
follow-ups. A follow-up starts a new turn and does not replay attachments or tool effects.

Live event delivery has no persistence or retry guarantee. Use a persisted queue outside lifecycle
events when durable processing is a requirement.

The template allows one follow-up per agent per plugin lifetime. Its set is updated before awaiting
send, so overlapping events cannot duplicate sends. Reload clears that bound. Provider turn IDs can
be null or repeat after reopen and are not sufficient for restart-safe idempotency. The regex is a
sample deny policy, not a shell parser or a complete deletion detector.
