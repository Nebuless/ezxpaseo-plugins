# Acceptance and trust gates

Source: https://paseo.sh/docs/plugins/reference#hosts-and-lifecycle and https://paseo.sh/docs/plugins/reference#cli-reference. Checked 2026-09-29.

## Before live installation

Plugins are trusted, unsandboxed code. Backend code and preparation commands can access files, processes, credentials, and network services as the daemon user. Client code runs inside the app. Review source and dependencies. Obtain user authorization for installation, global enablement, managed updates, publishing, and other external writes rather than treating static validation as approval.

Identify the actual daemon first. `paseo daemon status --json` supplies local daemon home. Read `<home>/config.json`; missing root `pluginsEnabled` means false. A plugin's `disabled` status cannot tell whether global or per-plugin switch caused it. If already true, do not ask to enable it again. If false, ask explicitly before changing it. Preserve unrelated config values. Remote host config must be changed on that host, not in the local file.

After an authorized global change run `paseo reload --json`, check `appliedPaths` for `pluginsEnabled`, and verify live catalog. No daemon restart. After source changes run `paseo plugin reload <runtime-id>`, not `paseo reload`.

## Evidence layers

1. Static validator: manifest, runtime boundaries, obvious client portability and package contents.
2. `npm run typecheck`: exact SDK contract, including type dependencies.
3. Focused tests: schemas, transformations, state races, cleanup and external protocol where relevant.
4. Offline bundle: syntax and resolution with host modules external. Not the Paseo compiler.
5. Live host: authorized install/reload, `ls` running without error, logs inspected, exact action exercised.
6. UI: wide and compact layouts, light/dark, missing records, offline selected host, pending/error, accessibility and reload teardown.

Subscribe to the exact event before triggering asynchronous tests. Use bounded timeouts, not fixed sleeps. For MCP, discover tools AND call one through actual transport. For providers, a real prompt and supported permission/cancel/restore behavior are mandatory.

Report target host, runtime ID, daemon/app versions, exact command and result, observed contribution, and what could not run. Never report `running` or mobile compatibility from typechecking alone.
