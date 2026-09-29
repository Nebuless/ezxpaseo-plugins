# Theme validation

Checked: 2026-09-29

Sources:

- [Agent Skills specification](https://agentskills.io/specification)
- [Paseo plugin reference: hosts and lifecycle](https://paseo.sh/docs/plugins/reference.md#hosts-and-lifecycle)

The range `>=0.9.2 <0.10.0` documents the tested baseline, not the theme API introduction.

Static checks can verify shape and hex syntax but not derived contrast. Real-host visual QA must
cover wide and compact surfaces, terminal ANSI colors, diffs, status colors, focus visibility,
selection persistence, plugin disable/removal, and fallback to the default theme.
