# Changed SDK contracts

Source: https://paseo.sh/docs/plugins/migration#composer-pills and https://paseo.sh/docs/plugins/reference#button-descriptor. Checked 2026-09-29.

Pill now requires `button`. Move title to `button.title`, custom component to `button.icon` plus `button.label`, onPress to `button.behavior: { kind: "action", onPress }`. Dynamic labels use registration `.update(patch)`. Cleanup uses `.remove()`, not calling handle. No `PluginComposerPillProps`. Header shares descriptor, context and handle contracts. `update` supplies complete new behavior object and closes open surface. Invalid update leaves previous descriptor intact.

Removed SDK subpaths: `/react-native`, `/ui`, `/provider`, `/acp` become `/client/react-native`, `/client/ui`, `/server/provider`, `/server/acp`. Removed `@paseo/plugin` scope. `/client/host` private. Types follow runtime boundaries too.

Input type helper is `RpcInput<typeof contract>` from SDK root, output `RpcOutput`. Hooks take `{ request }` and returned request, no implicit deep merge. Settings documents preserve invalid data, not auto-reset. Current compatibility treats prereleases by stable core, unlike older skill advice requiring explicitly listed beta versions.
