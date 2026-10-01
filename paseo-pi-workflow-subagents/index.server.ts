import type { PluginServerContext } from "@getpaseo/plugin/server";
import { SubagentBroker } from "./server/subagent-broker.ts";
import {
  PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN_ENV,
  PI_WORKFLOW_SUBAGENTS_BRIDGE_URL_ENV,
  watchWorkflowSubagentsRpc,
} from "./shared/subagents.ts";

export default function contribute(server: PluginServerContext) {
  const broker = new SubagentBroker();
  broker.start();

  const removeSessionHook = server.before(
    "agent.session_open",
    async ({ request }) => {
      if (request.provider !== "pi" || request.purpose !== "interactive") {
        return request;
      }

      const bridgeUrl = await broker.getUrl();
      const bridgeToken = broker.registerAgent(request.agentId);
      return {
        ...request,
        env: {
          ...request.env,
          [PI_WORKFLOW_SUBAGENTS_BRIDGE_URL_ENV]: bridgeUrl,
          [PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN_ENV]: bridgeToken,
        },
      };
    },
  );

  const removeArchiveHook = server.on("agent.archived", ({ agent }) => {
    broker.unregisterAgent(agent.id);
  });

  server.handle(watchWorkflowSubagentsRpc, async (input) =>
    broker.watch(input),
  );

  return async () => {
    removeSessionHook();
    removeArchiveHook();
    await broker.close();
  };
}
