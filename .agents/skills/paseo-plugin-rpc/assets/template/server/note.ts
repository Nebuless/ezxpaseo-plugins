import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import { publishNoteRpc } from "../shared/note.ts";

export async function publishNote(
  input: RpcInput<typeof publishNoteRpc>,
  { paseo }: PluginHandlerContext,
): Promise<RpcOutput<typeof publishNoteRpc>> {
  const itemId = `note-${input.noteId}`;
  const output = publishNoteRpc.output.parse({ itemId });

  await paseo.agents.ref(input.agentId).timeline.append({
    type: "plugin",
    id: itemId,
    kind: "rpc-note",
    version: 1,
    data: { label: input.label },
  });

  return output;
}
