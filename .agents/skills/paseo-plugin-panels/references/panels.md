# Panel API

Checked: 2026-09-29

Sources:

- [Paseo plugin reference: workspace panels](https://paseo.sh/docs/plugins/reference.md#workspace-panels)
- [Paseo plugin reference: theme and layout](https://paseo.sh/docs/plugins/reference.md#theme-and-layout)

`addWorkspacePanel` requires `id`, `title`, `icon`, `context`, and `Component`. `locations` defaults
to `["workspace"]`; add `"explorer"` explicitly for Explorer.

Workspace panels receive `workspaceId`. Agent panels also receive `agentId`. Use selector hooks
against the normalized cache. Both return `null` when unavailable. Paseo owns focus, splitting,
closing, persistence, query state, API/RPC providers, and the render error boundary.
