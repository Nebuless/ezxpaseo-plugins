import type { PluginServerContext } from "@getpaseo/plugin/server";
import { createMcpServerSource } from "./server/mcp-server-source.mjs";
import { QuestionBroker } from "./server/question-broker.ts";
import {
  ASK_BROKER_TOKEN_ENV,
  ASK_BROKER_URL_ENV,
  ASK_MCP_SERVER_NAME,
  ASK_TIMELINE_KIND,
  ASK_TIMELINE_VERSION,
} from "./shared/ask-schema.mjs";
import { answerAskRequestRpc } from "./shared/ask-user.ts";

const MCP_SERVER_SOURCE = createMcpServerSource();

export default function contribute(server: PluginServerContext) {
  const broker = new QuestionBroker();
  broker.start();

  const removeCreateHook = server.before("agent.create", ({ request }) => {
    // Pi and OMP use native companions; their adapters reject session MCP servers.
    if (
      request.config.internal ||
      request.config.provider === "omp" ||
      request.config.provider === "pi"
    ) {
      return request;
    }
    if (request.config.mcpServers?.[ASK_MCP_SERVER_NAME]) {
      throw new Error(
        `MCP server name is already configured: ${ASK_MCP_SERVER_NAME}`,
      );
    }
    return {
      ...request,
      config: {
        ...request.config,
        mcpServers: {
          ...request.config.mcpServers,
          [ASK_MCP_SERVER_NAME]: {
            type: "stdio",
            command: "node",
            args: ["--input-type=module", "--eval", MCP_SERVER_SOURCE],
            alwaysLoad: true,
          },
        },
      },
    };
  });

  const removeSessionHook = server.before(
    "agent.session_open",
    async ({ request }, context) => {
      if (request.purpose !== "interactive") {
        return request;
      }
      const brokerUrl = await broker.getUrl();
      const brokerToken = broker.issueToken();
      broker.registerAgent(
        request.agentId,
        brokerToken,
        async (timelineData) => {
          await context.paseo.agents.ref(request.agentId).timeline.append({
            type: "plugin",
            id: `ask-${timelineData.requestId}`,
            kind: ASK_TIMELINE_KIND,
            version: ASK_TIMELINE_VERSION,
            data: timelineData,
          });
        },
      );
      return {
        ...request,
        env: {
          ...request.env,
          [ASK_BROKER_URL_ENV]: brokerUrl,
          [ASK_BROKER_TOKEN_ENV]: brokerToken,
        },
      };
    },
  );

  const removeArchiveHook = server.on("agent.archived", ({ agent }) => {
    broker.unregisterAgent(agent.id);
  });

  server.handle(answerAskRequestRpc, async (input) => {
    await broker.answer(input);
    return { accepted: true as const };
  });

  return async () => {
    removeCreateHook();
    removeSessionHook();
    removeArchiveHook();
    await broker.close();
  };
}
