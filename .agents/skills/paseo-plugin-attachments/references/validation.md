# Attachment validation

Checked: 2026-09-29

Sources:

- [Agent Skills specification](https://agentskills.io/specification)
- [Paseo plugin reference: slash commands](https://paseo.sh/docs/plugins/reference.md#slash-commands)

The manifest's `>=0.9.2 <0.10.0` range is a tested baseline, not an API introduction date.

Verify Zod rejection, case-insensitive search, empty and no-result queries, stable IDs, URL validity,
complete snapshot text, composer removal, submission, and the documented slash-command collision.
The static authoring validator cannot prove RPC or composer behavior.
