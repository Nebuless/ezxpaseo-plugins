# ACP provider path

Checked 2026-09-29.

Sources:

- Paseo provider-plugin guide:
  https://paseo.sh/docs/plugins/providers.md#adapt-an-acp-agent
- Paseo supported providers, ACP catalog:
  https://paseo.sh/docs/supported-providers.md#acp-catalog
- Paseo custom providers, documented Gemini command:
  https://paseo.sh/docs/custom-providers.md#acp-providers

Gemini CLI is in Paseo's current ACP catalog. The deployed custom-provider docs show:

```json
{ "command": ["gemini", "--acp"] }
```

The template requires `PASEO_GEMINI_BIN` to contain an absolute path to that installed executable
and validates it before registration. This avoids PATH differences between an interactive shell and
the daemon without inventing another command.

`runAcpProvider()` owns process startup, ACP capability mapping, sessions, prompts, permissions, and
timeline conversion. Use transformers only for vendor behavior ACP cannot describe. Each
transformer must validate its vendor payload and pass through unrelated or malformed values.

Provider icons are plugin-directory-relative SVG paths. The file must be regular, self-contained,
and at most 64 KiB.
