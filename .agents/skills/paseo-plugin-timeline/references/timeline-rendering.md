# Transformers and renderers

Checked: 2026-09-29

Sources:

- [Paseo plugin reference: timeline items](https://paseo.sh/docs/plugins/reference.md#timeline-items)
- [Paseo plugin reference: theme and layout](https://paseo.sh/docs/plugins/reference.md#theme-and-layout)

Transformers select one coarse `query.itemType`, then inspect the typed item. They run during render
model construction, including live updates. Paseo derives replacement identity from the source;
use explicit IDs when one source expands into several rows.

Renderers match `kind` and `version`. Paseo validates `data` with their Zod schema before mounting.
`useRevealedText(text, phase)` matches native streaming pacing. The template's
`>=0.9.2 <0.10.0` range is its tested baseline, not an API-introduction claim.
