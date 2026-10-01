# Pi workflow sub-agents in Paseo

A read-only panel for Pi sessions launched by Paseo. It shows live workflow-launched and standalone `pi-extensible-workflows` sub-agents under their parent agent, without their prompts, transcripts, raw activity text, tool arguments/results, paths, or controls. The panel reports whether monitoring is connected, reconnecting, stale, unavailable, or incompatible. It cannot reconstruct events that occurred before the companion connected or while the bridge was down.

The companion bounds queued bridge updates. Pending updates coalesce per source and agent identity (including workflow run ID); terminal updates displace pending nonterminal progress when needed and cannot be replaced by later stale progress. If queue pressure still drops an update, monitoring reports a companion error rather than silently presenting a live feed.

## Compatibility

- Paseo daemon and client: 0.9.2 or newer, with the plugin panel APIs used here.
- `pi-extensible-workflows`: **5.17.2**. The Pi observer integration uses a mutable registry method in this release, not a public subscription API. An untested upstream version must report unsupported instead of silently showing an empty live list.
- The Pi companion and Paseo plugin are both needed. Installing only one does not provide monitoring.

## Install

From this repository, install dependencies and check the workspace:

```sh
npm install
npm run typecheck --workspace=paseo-pi-workflow-subagents
npm run test --workspace=paseo-pi-workflow-subagents
```

Install the companion as a local Pi package from the daemon machine, using this plugin directory's **absolute path**. Keep your existing `npm:pi-extensible-workflows` Pi package configured; its loaded version must be 5.17.2.

```sh
pi install /absolute/path/to/ezxpaseo-plugins/paseo-pi-workflow-subagents
pi list
```

The package's `pi.extensions` entry loads `pi/index.ts`. Pi sessions already running before the companion was loaded must be restarted; a Pi `/reload` reloads extensions but a session launched without Paseo's bridge environment still cannot be monitored. A regular Pi session outside Paseo is unaffected.

Paseo plugins are trusted, unsandboxed code on the daemon and in the client. Review the plugin before installing. Enable plugins in the target daemon's **Settings → Plugins** only with the daemon owner's permission; enabling is a global switch for all its plugins. Then install this directory on that daemon:

```sh
paseo plugin install /absolute/path/to/ezxpaseo-plugins/paseo-pi-workflow-subagents
paseo plugin ls
```

Open or resume a **Paseo-managed, interactive Pi** agent after both installations. Its session-open hook passes a scoped loopback address and fresh token to the companion. With that agent's tab focused, open Command Center (**Ctrl+K**, or **⌘K** on macOS), then select **Open Pi sub-agents**. This opens its **Sub-agents** panel. An empty connected panel means no agents have been observed; an unavailable/unsupported panel does not imply there are none. Workflow runs and standalone `subagents_run` calls appear separately even when they reuse an identifier. The plugin does not add timeline rows or allow steering the sub-agents.

## Removal

Disable or remove the Paseo plugin, then remove the matching Pi package source. Use the same absolute path passed at installation:

```sh
paseo plugin disable paseo-pi-workflow-subagents
paseo plugin remove paseo-pi-workflow-subagents
pi remove /absolute/path/to/ezxpaseo-plugins/paseo-pi-workflow-subagents
```

Restart active Pi sessions to stop loading the companion. This changes monitoring only; it does not migrate or delete the upstream workflow package's runs or sub-agent state. Existing running sessions may continue until stopped; a disconnected panel must report stale state rather than claim a live feed.
