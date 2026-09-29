# Verification record

Checked 2026-09-29 in repository checkout.

## Passed

- Official `skills-ref validate` passed all 20 skill directories. Reference tool fetched from Agent Skills revision `69ef37e9424c0a7ea9dd2293b559e43ec8176379`.
- Local YAML/name/metadata/resource-link validator passed all 20 skills with zero errors. Router and focused reference paths manually inspected.
- 25 tests passed in one final run, no failures. Includes positive/negative validator cases, schemas, attachment search, hook environment preservation and bounded follow-ups, MCP provider exclusions, real MCP stdio discovery/tool invocation, binary configuration, local usage calculation, and deterministic cache invalidation during pending response.
- All 14 templates targeting SDK 0.9.2 passed static preflight, exact-SDK TypeScript checking, in-memory bundle builds and `npm pack --dry-run --json --ignore-scripts` contents checks.
- Script diagnostics and changed TypeScript files checked with available language tooling, zero diagnostics. Configured Biome server unavailable for JSON/directory checks. JSON parsed by validators and TypeScript configs checked by compiler instead.
- Six SVG assets inspected: self-contained, 163-254 bytes, below 64 KiB.

Final focused test command:

```bash
node --test .agents/skills/paseo-plugin-authoring/scripts/*.test.mjs .agents/skills/paseo-plugin-{rpc,hooks,mcp,providers,usage}/assets/template/server/*.test.mjs .agents/skills/paseo-plugin-hosts/assets/template/client/*.test.mjs
```

## Explicit limitations

- Fifteenth template, usage source, requires documented SDK/runtime 0.9.3. Registry response at `https://registry.npmjs.org/@getpaseo%2fplugin/0.9.3` was `version not found: 0.9.3`. Installed SDK and live daemon are 0.9.2. Full usage typecheck/build cannot pass now. Local calculation test passed, upstream usage source/contracts inspected. Validator reports mismatch as failure rather than masking it.
- No example plugin was installed, globally enabled, reloaded or published. Live app loader, desktop/mobile rendering, settings two-client conflicts, real Gemini ACP session, and native gesture/keyboard checks are not claimed. These operations are outside creating a reusable skill suite and require separate authorized plugin work.
- Existing repository changes outside `.agents/skills/` were preserved. Root workspace checks were not used to validate unrelated in-progress plugins. No commit created.

## Sources

- https://paseo.sh/docs/plugins/reference
- https://paseo.sh/docs/plugins/publishing
- https://paseo.sh/docs/plugins/providers
- https://paseo.sh/docs/plugins/migration
- https://agentskills.io/specification
- https://agentskills.io/skill-creation/best-practices
