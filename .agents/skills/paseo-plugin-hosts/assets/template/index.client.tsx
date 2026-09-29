import type { PluginClientContext } from "@getpaseo/plugin/client";
import { HostsSurface } from "./client/hosts";

export default function contribute(client: PluginClientContext) {
  const removeSurface = client.addSurface("hosts", HostsSurface);
  const removeSidebar = client.addSidebarItem({
    id: "hosts",
    title: "Host agents",
    icon: "Server",
    surface: "hosts",
  });

  return () => {
    removeSidebar();
    removeSurface();
  };
}
