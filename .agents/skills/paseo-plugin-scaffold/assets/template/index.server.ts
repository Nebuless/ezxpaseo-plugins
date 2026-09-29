import type { PluginServerContext } from "@getpaseo/plugin/server";

export default function contribute(server: PluginServerContext) {
  const remove = server.on("agent.turn_ended", (event) => {
    console.log("Turn ended", event.agent.id, event.outcome.kind);
  });
  return remove;
}
