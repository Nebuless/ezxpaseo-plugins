import type {
  PluginAgentCommandContext,
  PluginClientContext,
} from "@getpaseo/plugin/client";
import { ActionPanel } from "./client/action-panel";

function openActionPanel({
  openPanel,
}: Pick<PluginAgentCommandContext, "openPanel">) {
  openPanel("action-demo");
}

export default function contribute(client: PluginClientContext) {
  const removePanel = client.addWorkspacePanel({
    id: "action-demo",
    title: "Action demo",
    icon: "Command",
    context: "agent",
    Component: ActionPanel,
  });
  const removeCommand = client.addCommandCenterItem({
    id: "open-action-demo",
    title: "Open action demo",
    icon: "Command",
    keywords: ["panel", "slash"],
    context: "agent",
    onSelect: openActionPanel,
  });
  const removeSlash = client.addSlashCommand({
    name: "action-demo",
    description: "Open the action demo panel",
    argumentHint: "",
    context: "agent",
    onSubmit: openActionPanel,
  });

  return () => {
    removeSlash();
    removeCommand();
    removePanel();
  };
}
