# Panel validation

Checked: 2026-09-29

Sources:

- [Agent Skills specification](https://agentskills.io/specification)
- [Paseo plugin reference: runtime modules](https://paseo.sh/docs/plugins/reference.md#runtime-modules)

The `>=0.9.2 <0.10.0` requirement is the tested baseline, not an API introduction date.

Static checks should catch runtime-boundary mistakes and obvious DOM usage. Host QA must also prove
tab restoration, a disappearing cached record, both declared locations, compact layout, theme
contrast, and plugin reload cleanup.
