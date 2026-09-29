import type { PluginServerContext } from "@getpaseo/plugin/server";
import { createHelperSource } from "./server/helper-source";

const SERVER_NAME = "local-echo";
const HELPER_SOURCE = createHelperSource();

export default function contribute(server: PluginServerContext) {
  const removeCreate = server.before("agent.create", ({ request }) => {
    if (request.config.internal || request.config.provider === "omp") return request;
    if (request.config.mcpServers?.[SERVER_NAME]) {
      throw new Error(`MCP server name is already configured: ${SERVER_NAME}`);
    }
    return {
      ...request,
      config: {
        ...request.config,
        mcpServers: {
          ...request.config.mcpServers,
          [SERVER_NAME]: {
            type: "stdio",
            command: "node",
            args: ["--input-type=module", "--eval", HELPER_SOURCE],
            alwaysLoad: true,
          },
        },
      },
    };
  });

  return () => {
    removeCreate();
  };
}
