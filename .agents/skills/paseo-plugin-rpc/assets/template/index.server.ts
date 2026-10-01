import type { PluginServerContext } from "@getpaseo/plugin/server";
import { publishNote } from "./server/note";
import { publishNoteRpc } from "./shared/note";

export default function contribute(server: PluginServerContext) {
  server.handle(publishNoteRpc, publishNote);
  return () => {};
}
