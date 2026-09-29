import type { PluginServerContext } from "@getpaseo/plugin/server";
import { preferences } from "../shared/preferences";

export function registerPreferences(server: PluginServerContext) {
  const settings = server.registerSettings(preferences);
  const unsubscribe = settings.subscribe((state) => {
    if (state.status === "ready") {
      console.log("Demo preferences updated", state.revision);
    }
  });
  return () => unsubscribe();
}
