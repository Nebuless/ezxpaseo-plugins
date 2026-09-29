# EZXPaseo plugins

This repository contains local Paseo plugins.

## Plugins

- `paseo-ask-user`: Adds structured questions and answers to agent timelines. Existing MCP behavior remains for providers other than Pi and OMP; optional native Pi/Sideroom and OMP companions bridge their native ask tools into Paseo. See [installation, behavior, and removal](paseo-ask-user/README.md).
- `paseo-pi-workflow-subagents`: Shows live Pi workflow and standalone sub-agent status in a read-only parent-agent panel. It requires a separately installed Pi companion and `pi-extensible-workflows` 5.17.2; see [installation and removal](paseo-pi-workflow-subagents/README.md).

## Development

Install all workspace dependencies:

```bash
npm install
```

Run formatting checks, type checks, and tests across every plugin:

```bash
npm run check
```
