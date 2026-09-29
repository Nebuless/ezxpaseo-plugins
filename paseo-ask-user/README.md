# Ask user questions from Pi and OMP

`paseo-ask-user` adds question-and-answer cards to interactive Paseo agent timelines. Non-Pi/OMP agents use the existing `paseo_ask_user` MCP tool. Pi and OMP use optional native companions because their adapters do not accept session MCP servers.

The companions are separate extensions; installing the Paseo plugin alone does not load either one. They make no upstream changes.

## Compatibility and safety

The Pi bridge was validated with **Pi 0.87.1 and Sideroom 8.11.0**. The OMP bridge was validated with **OMP 18.4.2** through its RPC UI and Paseo app. Do not assume other versions work. The Pi bridge relies on Sideroom's private loaded-package implementation; the OMP bridge relies on its native `ask` tool delegation/UI seam. Neither is a public subscription API. Upgrades may change those internals.

The companion must fail visibly if its expected runtime, native ask tool, or delegation seam is unavailable. It must not silently report an empty/successful answer or fall back to another protocol. With both `PASEO_ASK_USER_BROKER_URL` and `PASEO_ASK_USER_BROKER_TOKEN` absent, it is inert. Paseo's interactive session hook supplies these scoped broker values to the session when the plugin is enabled; **do not copy, configure, or publish the URL or token yourself**. Do not use the companions to send credentials to a remote broker.

Paseo plugins and native extensions execute trusted code. Review this plugin and each companion before loading it.

## Install Paseo plugin

Enable plugins for the target daemon in **Settings → Plugins** with the daemon owner's permission, then install this plugin from the checkout on that daemon:

```sh
paseo plugin install /absolute/path/to/ezxpaseo-plugins/paseo-ask-user
paseo plugin ls
```

The plugin's session hook provides the broker environment to interactive Paseo-managed agents. No manual broker setup is needed. While a questionnaire is pending, its timeline card also offers **Cancel questionnaire**; this remains available for the existing MCP flow.

## Load the native companion

Use the companion file path from the checkout, accessible to the Pi or OMP process. The examples use absolute paths so the extension does not depend on the session's working directory. These commands load the companion for that invocation only; they do not edit persistent settings.

### Pi with Sideroom

```sh
pi --extension /absolute/path/to/ezxpaseo-plugins/paseo-ask-user/pi/index.ts
```

Pi's `-e` is the same flag:

```sh
pi -e /absolute/path/to/ezxpaseo-plugins/paseo-ask-user/pi/index.ts
```

Run an interactive, Paseo-managed Pi session. The companion delegates to the existing Sideroom ask implementation, retaining its single- and multiple-selection, custom-answer, out-of-scope, and cancel semantics. A broker timeout or cancellation returns as Sideroom's native cancelled-questionnaire result; Pi has no separate `chat` result action. The Paseo timeline receives the question and answer results; the companion does not replace Sideroom's parser or formatter. Pi sessions without the Paseo-provided broker environment remain unchanged.

### OMP

Use interactive RPC UI mode so the native ask UI is available:

```sh
omp --mode rpc-ui --extension /absolute/path/to/ezxpaseo-plugins/paseo-ask-user/omp/index.mjs
```

OMP also accepts `-e` for `--extension`:

```sh
omp --mode rpc-ui -e /absolute/path/to/ezxpaseo-plugins/paseo-ask-user/omp/index.mjs
```

The companion wraps OMP's existing native `ask` tool only for sessions with Paseo's broker environment, preserving its native validation and result handling. Native previews and answer notes remain available; empty multiple selections are allowed; the `chat` action returns to the conversation, and cancel aborts the ask. OMP's native protocol has no out-of-scope answer, so that Pi-specific answer is not available in OMP. OMP sessions without the Paseo-provided broker environment remain unchanged.

## Existing MCP behavior

The `paseo_ask_user` MCP tool and its input/result contract remain unchanged for providers other than Pi and OMP. Native companions do not install an MCP server. Pi and OMP use their native companion rather than session MCP.

## Remove

Disable and remove the Paseo plugin from the target daemon:

```sh
paseo plugin disable paseo-ask-user
paseo plugin remove paseo-ask-user
```

Remove the `--extension`/`-e` argument from Pi or OMP launch commands to stop loading that companion. The examples above do not persistently install extensions or change settings, so no package removal is needed; do not remove Sideroom or unrelated extensions. Remove each companion argument separately if both were used. Restart active sessions after removing the plugin or companion argument; this only removes question integration and does not change agent conversation history or other plugins.
