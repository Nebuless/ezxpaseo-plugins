---
name: paseo-plugin-providers
description: Build and verify Paseo provider plugins using the ACP shim or the direct provider protocol. Use when adding an existing coding agent to Paseo, adapting documented ACP behavior, or implementing a native SDK or process adapter.
---

# Paseo provider plugins

Prefer `runAcpProvider()` for an agent that already speaks ACP. Implement the direct protocol only
when the agent exposes a different SDK, JSON-RPC API, or process protocol.

## Reference index

| Goal | Read | Template |
| --- | --- | --- |
| Wrap existing ACP agent | [Guide](references/acp.md) | [Complete template](assets/template) |
| Implement native direct protocol | [Guide](references/direct-protocol.md) | [Complete template](assets/template) |

## Read first

- [ACP provider path](references/acp.md)
- [Direct provider protocol](references/direct-protocol.md)
- Copyable verified-agent template: [assets/template](assets/template)
- Suite validator: [../paseo-plugin-authoring/scripts/validate-plugin.mjs](../paseo-plugin-authoring/scripts/validate-plugin.mjs)

## Workflow

1. Verify the agent appears in the current supported-provider docs and record its documented ACP
   command.
2. Require an explicit executable path from configuration. Validate that it is absolute, regular,
   and executable before registration.
3. Use `runAcpProvider()` with a direct argv tuple. Do not add transformers without a documented
   vendor mismatch.
4. Give the provider a self-contained SVG path relative to the plugin root.
5. If ACP does not fit, implement the direct protocol from the reference: connection lifecycle,
   catalog, open, prompt result, turn lifecycle, timeline snapshots, permissions, persistence, and
   close.
6. Advertise only capabilities the implementation completes.
7. Validate and test:

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
cd /absolute/path/to/plugin
npm install
npm run typecheck
npm test
```

8. Create a real session with the installed agent and complete one prompt.

The suite validator is static preflight. It does not launch the agent or prove protocol behavior.
Install this skill with the sibling `paseo-plugin-authoring` suite.

## Edge cases

- `send()` reports acceptance only; results are provider events.
- Every `clientMessageId` gets exactly one `session.prompt_result`.
- Every started turn gets one terminal completed, failed, or canceled event.
- Reuse timeline item IDs to publish complete streaming snapshots.
- Refresh closes and reopens with current configuration and persistence; re-read external state.
- ACP transformers validate vendor payloads and leave malformed or unrelated values unchanged.
- Missing or non-executable binaries fail clearly. Never ship a placeholder command.
- SVG files must be self-contained and no larger than 64 KiB.

## Done gate

- Agent and command are sourced from current documentation.
- Binary configuration is explicit and validated before provider registration.
- No fake direct adapter or placeholder executable remains.
- Icon passes size and self-containment checks.
- Typecheck and tests pass.
- Real reload, running status, logs, session creation, and prompt completion pass.

Before live reload or installation, read [trust gates](../paseo-plugin-authoring/references/quality-gates.md). Obtain authorization, then reload the exact runtime ID, inspect `paseo plugin ls <runtime-id>` and `paseo plugin logs <runtime-id>`, and exercise the behavior.
