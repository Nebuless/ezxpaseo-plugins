# Runtime boundaries

Source: https://paseo.sh/docs/plugins/reference#runtime-modules. Checked 2026-09-29.

Client can import exactly these host specifiers: `@getpaseo/plugin`, `/client`, `/client/ui`, `/client/react-native`, `@tanstack/react-query`, `react`, `react/jsx-runtime`, `react-native`, `zod`. Package presence in node_modules does not make subpaths available: `zod/v4`, SVG/icon packages and `/client/host` fail in the app loader.

Server can use root SDK, `/server`, `/server/provider`, `/server/acp`, `zod`, Node APIs, and installed server dependencies. Usage module requires SDK/runtime 0.9.3. Server cannot import React, React Native or client SDK. Shared code imports only shared modules and runtime-neutral packages, never runtime types from `/client` or `/server`.

Rules include type imports, re-exports and transitive dependencies. Root helper modules are not permitted. Declaration modules should follow the same ownership. Keep DOM out of TypeScript `lib` and triple-slash references. React Native UI does not use HTML or browser globals. Any exceptional web-only behavior requires explicitly guarded exports under `client/web.ts` and native behavior, not a DOM escape for components.

Server bundles execute away from source paths. Neither `process.cwd()` nor `import.meta.url` locates installed helpers. Use a daemon-PATH executable or self-contained helper passed as argv, not a hardcoded source path. A successful local typecheck cannot establish the host allowlist, so reload and inspect logs too.
