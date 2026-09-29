import type { PluginServerContext } from "@getpaseo/plugin/server";
import { registerPreferences } from "./server/preferences";

export default function contribute(server: PluginServerContext) {
  return registerPreferences(server);
}
