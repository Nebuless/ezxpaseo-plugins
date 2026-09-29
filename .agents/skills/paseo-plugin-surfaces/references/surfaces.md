# Surface API

Checked: 2026-09-29

Sources:

- [Paseo plugin reference: surfaces and sidebar items](https://paseo.sh/docs/plugins/reference.md#surfaces-and-sidebar-items)
- [Paseo plugin reference: theme and layout](https://paseo.sh/docs/plugins/reference.md#theme-and-layout)

Call `addSurface(id, Component)` before `addSidebarItem({ id, title, icon, surface: id })`.
`PluginSurfaceProps` supplies `theme`, `host`, `layout`, and optional `navigation`. Paseo owns the
route, header, host picker, close action, error boundary, and query client.

Use `theme.colors.foreground` for primary text, `foregroundMuted` for detail text, and `surface0`
for the root. Tighten spacing when `layout.compact` is true. Use only React Native primitives.

Each normal `add*` registration returns an idempotent remover. Return an entry cleanup that calls
the removers your plugin retains.
