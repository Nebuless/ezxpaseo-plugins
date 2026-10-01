# Daemon timeline append

Checked: 2026-09-29

Sources:

- [Paseo plugin reference: append a timeline row](https://paseo.sh/docs/plugins/reference.md#append-a-timeline-row-from-the-daemon)
- [Agent Skills specification](https://agentskills.io/specification)

From a server handler, call `paseo.agents.ref(agentId).timeline.append()` with `type: "plugin"`,
stable `id`, renderer `kind`, positive `version`, and JSON-compatible `data`. Reusing the same ID
replaces the prior row. Serialized data is capped at 64 KiB and rejected rather than truncated.

The daemon stamps the plugin ID. Confirm
`server_info.features.pluginTimelineItems` before depending on append support. A renderer for the
exact kind/version must be installed or Paseo shows an unavailable placeholder. Rows survive
refetch and reconnect, but not daemon restart.
