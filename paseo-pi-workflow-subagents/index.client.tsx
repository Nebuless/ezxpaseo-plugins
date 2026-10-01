import type { PluginClientContext } from "@getpaseo/plugin/client";
import { AgentSubagentsPanel } from "./client/subagents-panel";

export default function contribute(client: PluginClientContext) {
  client.addWorkspacePanel({
    id: "pi-workflow-subagents",
    title: "Sub-agents",
    icon: "GitBranch",
    context: "agent",
    locations: ["workspace", "explorer"],
    Component: AgentSubagentsPanel,
  });
  client.addCommandCenterItem({
    id: "open-pi-workflow-subagents",
    title: "Open Pi sub-agents",
    icon: "GitBranch",
    context: "agent",
    onSelect({ openPanel }) {
      openPanel("pi-workflow-subagents");
    },
  });
  return () => {};
}
