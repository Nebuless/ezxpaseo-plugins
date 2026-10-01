# Git and private registry setup

Source: https://paseo.sh/docs/plugins/publishing#share-through-github-or-git and https://paseo.sh/docs/plugins/reference#cli-reference. Checked 2026-09-29.

Git server dependencies require committed `package-lock.json` plus `build: [["npm", "ci", "--omit=dev"]]`. Host-only plugins need no build. Preparation commands run unsandboxed from selected plugin directory, not monorepo root. A nested source cannot assume sibling code/assets are included. Failure discards candidate and preserves previous managed revision.

No shell interpolation, pipes or `&&` unless shell explicitly invoked, which expands trust surface and should be avoided. Use separate argv arrays. Executables must exist on daemon PATH. Non-cross-platform native dependencies require platform matrix checks.

Private npm registry setup uses daemon user's scope config and credentials. App takes identifier only. For GitHub Packages, source docs specify `npm login --scope=@acme --auth-type=legacy --registry=https://npm.pkg.github.com` with appropriate package-read token. Never commit `.npmrc` containing tokens or print credentials. Publisher access and daemon install access are separate.
