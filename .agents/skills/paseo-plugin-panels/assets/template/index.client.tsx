import type { PluginClientContext } from "@getpaseo/plugin/client";
import { AgentOverview } from "./client/agent-overview";

export default function contribute(client: PluginClientContext) {
  const removePanel = client.addWorkspacePanel({
    id: "agent-overview",
    title: "Agent overview",
    icon: "PanelsTopLeft",
    context: "agent",
    locations: ["workspace", "explorer"],
    Component: AgentOverview,
  });
  const removeAction = client.addCommandCenterItem({
    id: "open-agent-overview",
    title: "Open agent overview",
    icon: "PanelsTopLeft",
    context: "agent",
    onSelect({ openPanel }) { openPanel("agent-overview"); },
  });
  return () => { removeAction(); removePanel(); };
}
