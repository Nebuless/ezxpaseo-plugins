# Verification matrix

Source: https://paseo.sh/docs/plugins/reference and https://agentskills.io/specification. Checked 2026-09-29.

| Change | Required checks |
| --- | --- |
| Manifest/imports | Static preflight, SDK typecheck, real install/reload and logs |
| RPC | Valid/invalid input, output schema failure, handler error, actual client call |
| Hook | Merged fields, immutable fields, timeout abort, overlap, remove; before failure vs event error |
| MCP helper | Discovery plus actual tool call, transport framing, agent create/resume/refresh, reload token lifecycle |
| Panel/actions | Correct host/context, missing snapshots, slash collisions and attachment suppression |
| Buttons | Duplicate target, complete behavior replacement, hidden/disabled pending action, idempotent removal |
| Timeline | Streaming/complete, identity, undefined/empty/multiple output, schema reject, size, missing renderer |
| Settings | Defaults, invalid storage preserved, migration once, save false, stale draft revision, two clients |
| Provider | Real prompt, exactly one prompt result, terminal event, cancel, advertised permissions/restore, teardown |
| Usage | Stable nonsecret key, no credentials, status variants, discovery, selective refresh, SVG and 0.9.3 |
| Distribution | Dry-run exact contents, registry host, suppressed scripts, preparation failure preserves old managed install |

One exact event subscription before async trigger, bounded timeout afterward. No fixed sleep for readiness. Test mocks preserve behavior being asserted. A static AST audit catches known forbidden imports but not accessibility, secrets, complete cleanup or runtime host support.

Manual UI: keyboard and accessible labels, selectable content where useful, compact keyboard clearance, modal one vertical scroll owner, missing/long values and theme contrast. Real mobile app or emulator required to claim native gesture/keyboard correctness.
