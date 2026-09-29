# Project contract

Source: https://paseo.sh/docs/plugins/reference#project-files. Checked 2026-09-29.

Manifest requires `id`, starting lowercase letter, then lowercase letters, digits, hyphens. Description is optional nonempty text. `requirements` currently supports only `paseo`, an npm semver range. Empty/invalid ranges and unknown requirement keys fail. Build is optional list of nonempty argument arrays, not shell strings.

Entries default-export one contribution function with `PluginClientContext` or `PluginServerContext` from its respective SDK subpath and return cleanup. Async cleanup is supported. No old `index.ts` compatibility entry. `.tsx` is needed for JSX, and both runtimes accept `.ts` or `.tsx`.

Pin SDK to the version being checked. Generated scaffold uses CLI version as minimum and SDK version. Minimum alone includes future breaking releases. Manifest compatibility applies before preparation and activation, and each app checks before evaluating its client entry.

Package `files` includes manifest, actual entries, runtime directories and every extra asset. npm plugin consumers do not install host devDependencies. Normal TypeScript needs no prepublication build. Templates deliberately use SDK 0.9.2 already present in this repository.
