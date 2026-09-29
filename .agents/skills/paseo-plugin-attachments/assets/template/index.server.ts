import type { PluginServerContext } from "@getpaseo/plugin/server";
import { searchResources } from "./server/resources";
import { searchDemoResources } from "./shared/resources";

export default function contribute(server: PluginServerContext) {
  server.handle(searchDemoResources, searchResources);
  return () => {};
}
