import type { PluginClientContext } from "@getpaseo/plugin/client";
import { registerTheme } from "./client/register";

export default function contribute(client: PluginClientContext) {
  return registerTheme(client);
}
