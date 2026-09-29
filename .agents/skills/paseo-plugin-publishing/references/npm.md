# npm artifact contents

Source: https://paseo.sh/docs/plugins/publishing#publish-on-npm. Checked 2026-09-29.

Paseo compiles TypeScript. Ordinary plugins ship sources, not a separately bundled app. Scaffold `files` covers manifest, all possible entries, client/server/shared. Add assets outside those dirs explicitly. Runtime dependency code installs with package. SDK, React, React Native, query library and Zod host instance use development dependencies for client tooling.

Generate code/assets before publishing. Keep generated JS under runtime owner. Own bundles must externalize host modules. Remove Git-only npm-ci commands from published manifest because npm acquisition already installs production dependencies. Native packages whose scripts are suppressed require explicit setup.

`npm pack --dry-run --json --ignore-scripts` lists artifact without running package scripts. Check all transitive source files and assets, not just entry names. Dry-run cannot prove dependency installation or host evaluation. Use exact-version staging installation after release, keeping registry scope and permissions correct.
