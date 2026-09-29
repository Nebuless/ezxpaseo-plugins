# Source parsing and ambiguity

Source: https://paseo.sh/docs/plugins/reference#plugin-sources. Checked 2026-09-29.

Resolution happens on daemon, not app. Existing complete identifier directory wins, including literal `:`. Next explicit prefixes select acquisition. Final subdirectory suffix has no empty, `.` or `..` segments, except lone `.` means root. `/` and `\` are accepted separators, prefer `/`. Ports and SCP colon stay part of source. Invalid suffix remains part of identifier, not sanitized into a directory.

Then existing remaining directory wins. Git URLs/SCP resolve as Git, exact `owner/repository` expands to GitHub, then remaining npm names/selectors resolve through daemon registry. Other forms reject. npm names lowercase, components start letter/digit then letters/digits/dot/underscore/hyphen. Aliases, tarball URLs and npm `file:` specifications are not source identifiers.

| Identifier | Interpretation / edge |
| --- | --- |
| `/srv/plugins/review` | Daemon directory, not client machine |
| `github:acme/mono:plugins/review` | GitHub with nested plugin |
| `git:https://git.example.com:8443/acme/mono.git:plugins/review` | URL port retained, last valid suffix selects plugin |
| `git@git.example.com:acme/review.git` | SCP Git |
| `file:///srv/repos/mono:plugins/review` | Git acquisition, managed checkout |
| `npm:@acme/review@next` | Registry tag chooses installation content |
| `'npm:@acme/review@>=1.2.0 <2.0.0'` | Shell quoting required |
| `npm:review@1.2.0:nested` | Explicit prefix avoids SCP ambiguity |
| `~/plugins/review` in app | No tilde expansion; shell may expand CLI argument |

Legacy `--path` is equivalent to suffix. `--ref` is Git-only. Windows daemon paths must be interpreted by that daemon, not normalized using the agent's Linux filesystem.
