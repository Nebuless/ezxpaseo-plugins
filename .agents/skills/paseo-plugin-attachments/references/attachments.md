# Attachment contracts

Checked: 2026-09-29

Sources:

- [Paseo plugin reference: composer attachment source](https://paseo.sh/docs/plugins/reference.md#add-a-composer-attachment-source)
- [Paseo plugin reference: plugin backend behavior](https://paseo.sh/docs/plugins/reference.md#add-plugin-specific-backend-behavior)

Use `defineRpc` and `defineAttachmentSource` in shared code. The search result contains `id`,
`identifier`, `title`, optional `subtitle`, valid `url`, complete `text`, and `resourceType`.
Paseo owns the menu, search picker, selected pill, draft state, and submission.

Keep secrets and untrusted I/O in the daemon handler. Inputs and outputs are validated on both
sides. The template resources are explicitly in-memory demo data derived from public Paseo docs.
