import type { PluginServerContext } from "@getpaseo/plugin/server";
import {
  discoverLocalUsage,
  fetchLocalUsage,
  identifyLocalUsage,
} from "./server/source";
import { localUsageInputSchema } from "./shared/input";

export default function contribute(server: PluginServerContext) {
  server.registerUsageSource({
    id: "local-activity",
    label: "Local activity",
    icon: "icon.svg",
    input: localUsageInputSchema,
    discover: discoverLocalUsage,
    identify: identifyLocalUsage,
    fetch: fetchLocalUsage,
  });
  return () => {};
}
