import type { PluginClientContext } from "@getpaseo/plugin/client";
import { SettingsScreen } from "./client/settings-screen";

export default function contribute(client: PluginClientContext) {
  const removeScreen = client.addSettingsScreen({
    id: "preferences",
    title: "Demo preferences",
    icon: "Settings2",
    Component: SettingsScreen,
  });
  return () => removeScreen();
}
