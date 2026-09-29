import type { PluginClientContext } from "@getpaseo/plugin/client";
import { DemoSurface } from "./client/demo-surface";

export default function contribute(client: PluginClientContext) {
  const removeSurface = client.addSurface("main", DemoSurface);
  const removeSidebarItem = client.addSidebarItem({
    id: "main",
    title: "Surface demo",
    icon: "PanelLeft",
    surface: "main",
  });

  return () => {
    removeSidebarItem();
    removeSurface();
  };
}
