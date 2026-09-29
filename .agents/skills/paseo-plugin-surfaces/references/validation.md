# Surface validation

Checked: 2026-09-29

Sources:

- [Agent Skills specification](https://agentskills.io/specification)
- [Paseo plugin reference: project files](https://paseo.sh/docs/plugins/reference.md#project-files)

The template's `>=0.9.2 <0.10.0` range records the tested Paseo baseline. It does not claim that
surfaces were introduced in 0.9.2.

Check the skill metadata, all relative links, runtime import boundaries, manifest range, absence
of DOM APIs, and client entry cleanup. The authoring validator is static and cannot replace
`npm run typecheck` or host installation.

Host QA must cover sidebar navigation, the button's state change, wide and compact layouts, at
least two themes, plugin reload, and `paseo plugin ls` reporting `running`.
