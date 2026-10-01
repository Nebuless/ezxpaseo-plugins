# Button contracts

Checked: 2026-09-29

Sources:

- [Paseo plugin reference: header buttons](https://paseo.sh/docs/plugins/reference.md#header-buttons)
- [Paseo plugin reference: button descriptor](https://paseo.sh/docs/plugins/reference.md#button-descriptor)

Current signatures:

```ts
client.addHeaderButton({ id, workspaceId, button });
client.addComposerPill({ id, workspaceId, agentId, button });
```

Both return `{ update(patch), remove() }`, not callable removal functions. A descriptor requires
`title`, `icon`, and an action, menu, or popover `behavior`. Paseo owns pressability, pending state,
error toast, placement, overflow, and compact sheet behavior.
