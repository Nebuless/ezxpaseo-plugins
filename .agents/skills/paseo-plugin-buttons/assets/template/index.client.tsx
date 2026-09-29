import type { PluginClientContext } from "@getpaseo/plugin/client";
import { createButtonsPanel } from "./client/buttons-panel";

export default function contribute(client: PluginClientContext) {
  const removePanel = client.addWorkspacePanel({
    id: "button-demo",
    title: "Button demo",
    icon: "MousePointerClick",
    context: "agent",
    Component: createButtonsPanel(client),
  });
  const removeAction = client.addCommandCenterItem({
    id: "open-button-demo",
    title: "Open button demo",
    icon: "MousePointerClick",
    context: "agent",
    onSelect({ openPanel }) { openPanel("button-demo"); },
  });
  return () => { removeAction(); removePanel(); };
}
