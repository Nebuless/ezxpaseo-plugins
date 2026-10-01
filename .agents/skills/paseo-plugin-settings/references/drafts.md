# Revision-safe drafts

Checked: 2026-09-29

Sources:

- [Paseo settings example](https://github.com/getpaseo/paseo/tree/main/plugin-examples/settings)
- [Agent Skills specification](https://agentskills.io/specification)

Capture values and revision together when opening an editor. Keep that opaque revision until a
save succeeds or the user explicitly discards. `save(completeValues, revision)` returns `false`
for validation, conflict, or transport failure and sets `saveError`; it does not throw.

A conflict means another client saved newer values. Preserve the user's draft and its original
revision so they can inspect it. Reload reads current persisted values but does not automatically
discard component-owned draft state. Invalid storage remains intact until explicit reset.
