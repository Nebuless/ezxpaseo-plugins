# Preparation, updates and removal

Source: https://paseo.sh/docs/plugins/reference#cli-reference and https://paseo.sh/docs/plugins/publishing. Checked 2026-09-29.

Git default is remote HEAD. npm default is `latest`; isolated candidate keeps production dependency tree and lockfile. Registry credentials and PATH belong to daemon user. npm lifecycle scripts are skipped, including dependencies. Native rebuilds need explicit manifest preparation.

`build` is list of argv arrays, executed sequentially without shell from staged plugin directory. `[["npm", "ci", "--omit=dev"]]` needs committed lockfile. No automatic package manager inference. Compatibility is checked before preparation. Candidate download, preparation, compile or activation failure preserves old managed installation.

Ordinary update checks npm latest/newer only and Git default HEAD, not installed tag/branch. `--check` previews without applying, even with `--yes`. `--all` reports independently. Explicit `--version` or `--ref` applies selected single-plugin update without another prompt, so obtain authorization before invoking. Cannot combine explicit target with `--all`. Ordinary noninteractive or JSON update needs `--yes`.

Directory update skips. Local reload failure stays failed, unlike managed update rollback. Removal retains directory source but deletes managed Git/npm files and installation settings. Install-time `--id` identifies runtime and enables multiple installs of same source.
