import type { PluginClientContext } from "@getpaseo/plugin/client";
import { demoResources } from "../shared/resources";

export function registerAttachmentSource(client: PluginClientContext) {
  const removeSource = client.addAttachmentSource(demoResources);
  return () => removeSource();
}
