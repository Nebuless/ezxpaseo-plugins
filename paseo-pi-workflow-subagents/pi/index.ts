import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { clearTimeout, setTimeout } from "node:timers";
import type { ExtensionAPI, ToolInfo } from "@earendil-works/pi-coding-agent";
import {
  companionMessageSchema,
  PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN_ENV,
  PI_WORKFLOW_SUBAGENTS_BRIDGE_URL_ENV,
  UNSUPPORTED_CODE,
} from "../shared/subagent-schema.mjs";
import { loadingRegistry } from "pi-extensible-workflows/registry";
import { startPiWorkflowSubagentObserver } from "./observer.mjs";

const SUPPORTED_WORKFLOW_PACKAGE_VERSION = "5.17.2";
const REQUIRED_WORKFLOW_TOOLS = ["workflow", "subagents_run"] as const;
const WORKFLOW_RUNTIME_TOOL_NAMES: Record<string, true> = {
  workflow: true,
  workflow_catalog: true,
  subagents_run: true,
  subagents_inspect: true,
  subagents_steer: true,
  subagents_stop: true,
  subagents_retry: true,
};
const BRIDGE_REQUEST_TIMEOUT_MS = 2_500;

async function packageForTool(tool: ToolInfo) {
  const sourcePath = tool.sourceInfo?.path;
  if (typeof sourcePath !== "string" || !sourcePath) return undefined;

  let directory = dirname(resolve(sourcePath));
  for (;;) {
    try {
      const manifest = JSON.parse(
        await readFile(join(directory, "package.json"), "utf8"),
      );
      if (manifest.name === "pi-extensible-workflows") {
        return manifest.version;
      }
    } catch {
      // The loaded extension may be nested below the package root.
    }

    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

async function isSupportedWorkflowRuntime(pi: ExtensionAPI) {
  let tools: ToolInfo[];
  try {
    if (typeof pi.getAllTools !== "function") return false;
    tools = pi.getAllTools();
  } catch {
    return false;
  }
  if (!Array.isArray(tools)) return false;

  for (const requiredName of REQUIRED_WORKFLOW_TOOLS) {
    let found = false;
    for (const tool of tools) {
      if (tool.name !== requiredName) continue;
      if (found) return false;
      found = true;
    }
    if (!found) return false;
  }

  let inspected = 0;
  for (const tool of tools) {
    if (!Object.hasOwn(WORKFLOW_RUNTIME_TOOL_NAMES, tool.name)) continue;
    inspected += 1;
    const loadedPackage = await packageForTool(tool);
    if (loadedPackage !== SUPPORTED_WORKFLOW_PACKAGE_VERSION) {
      return false;
    }
  }
  return inspected > 0;
}

function statusEndpoint(bridgeUrl: string) {
  try {
    const endpoint = new URL(bridgeUrl);
    const hostname = endpoint.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
    if (
      endpoint.protocol !== "http:" ||
      !["127.0.0.1", "::1", "localhost"].includes(hostname) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    ) {
      return undefined;
    }
    endpoint.pathname = `${endpoint.pathname.replace(/\/+$/u, "")}/status`;
    return endpoint.href;
  } catch {
    return undefined;
  }
}

async function reportUnsupportedWorkflowVersion(
  bridgeUrl: string,
  bridgeToken: string,
  piSessionId: string,
  lifecycleSignal: AbortSignal,
) {
  const endpoint = statusEndpoint(bridgeUrl);
  const fetchImpl = globalThis.fetch;
  if (
    !endpoint ||
    typeof fetchImpl !== "function" ||
    /[\u0000-\u001f\u007f]/u.test(bridgeToken)
  ) {
    return;
  }

  const parsed = companionMessageSchema.safeParse({
    type: "unsupported",
    piSessionId,
    code: UNSUPPORTED_CODE.UNSUPPORTED_WORKFLOW_VERSION,
  });
  if (!parsed.success) return;
  if (lifecycleSignal.aborted) return;

  const controller = new AbortController();
  const abortForLifecycle = () => controller.abort();
  if (lifecycleSignal.aborted) return;
  lifecycleSignal.addEventListener("abort", abortForLifecycle, { once: true });
  if (lifecycleSignal.aborted) controller.abort();
  const timeout = setTimeout(
    () => controller.abort(),
    BRIDGE_REQUEST_TIMEOUT_MS,
  );
  try {
    await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bridgeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed.data),
      redirect: "error",
      // Node fetch accepts Node AbortSignal; React Native's ambient type differs.
      // @ts-expect-error React Native RequestInit overrides the Node fetch type.
      signal: controller.signal,
    });
  } catch {
    // A monitoring failure never affects the Pi session.
  } finally {
    clearTimeout(timeout);
    lifecycleSignal.removeEventListener("abort", abortForLifecycle);
  }
}

export default function registerPiWorkflowSubagentCompanion(pi: ExtensionAPI) {
  let stopObserver: (() => void) | undefined;
  let sessionLifecycle: AbortController | undefined;
  let sessionGeneration = 0;

  const invalidateSession = () => {
    sessionGeneration += 1;
    sessionLifecycle?.abort();
    sessionLifecycle = undefined;
    stopObserver?.();
    stopObserver = undefined;
    return sessionGeneration;
  };

  pi.on("session_start", async (_event, context) => {
    const generation = invalidateSession();
    const lifecycle = new AbortController();
    sessionLifecycle = lifecycle;

    const bridgeUrl = process.env[PI_WORKFLOW_SUBAGENTS_BRIDGE_URL_ENV];
    const bridgeToken = process.env[PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN_ENV];
    if (!bridgeUrl || !bridgeToken) return;

    let piSessionId: string;
    try {
      piSessionId = context.sessionManager.getSessionId();
    } catch {
      return;
    }

    const supported = await isSupportedWorkflowRuntime(pi);
    if (generation !== sessionGeneration || lifecycle.signal.aborted) return;

    if (!supported) {
      await reportUnsupportedWorkflowVersion(
        bridgeUrl,
        bridgeToken,
        piSessionId,
        lifecycle.signal,
      );
      return;
    }

    if (generation !== sessionGeneration || lifecycle.signal.aborted) return;
    const observer = startPiWorkflowSubagentObserver({
      pi,
      piSessionId,
      bridgeUrl,
      bridgeToken,
      loadingRegistry,
    });
    stopObserver = observer.stop;
  });

  pi.on("session_shutdown", () => {
    invalidateSession();
  });
}
