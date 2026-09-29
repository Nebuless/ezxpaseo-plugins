# Theme contract

Checked: 2026-09-29

Sources:

- [Paseo plugin reference: contribute a theme](https://paseo.sh/docs/plugins/reference.md#contribute-a-theme)
- [Paseo plugin reference: theme and layout](https://paseo.sh/docs/plugins/reference.md#theme-and-layout)

`addTheme` takes `id`, `name`, `appearance`, and a small palette. Required colors are
`background`, `foreground`, `raised`, `control`, `border`, `mutedForeground`, and `ring`;
`accent` is optional. Paseo derives the full token set for panels, menus, diffs, status colors,
syntax, terminal, and shadows.

Theme palette data is the exception to the normal ban on hardcoded UI colors: exact hex values are
the contribution. Components must still consume `theme.colors` rather than importing the palette.
