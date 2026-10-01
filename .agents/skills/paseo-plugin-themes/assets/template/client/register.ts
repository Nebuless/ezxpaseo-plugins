import type { PluginClientContext } from "@getpaseo/plugin/client";
import { CALM_NIGHT } from "../shared/palette";

export function registerTheme(client: PluginClientContext) {
  const removeTheme = client.addTheme(CALM_NIGHT);
  return () => removeTheme();
}
