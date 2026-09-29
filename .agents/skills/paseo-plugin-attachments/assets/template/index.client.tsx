import type { PluginClientContext } from "@getpaseo/plugin/client";
import { registerAttachmentSource } from "./client/register";

export default function contribute(client: PluginClientContext) {
  return registerAttachmentSource(client);
}
