import type { PluginClientContext } from "@getpaseo/plugin/client";
import { NoteRow } from "./client/note";
import { noteDataSchema, publishNoteRpc } from "./shared/note";

export default function contribute(client: PluginClientContext) {
  const removeRenderer = client.addTimelineRenderer({
    kind: "rpc-note",
    version: 1,
    schema: noteDataSchema,
    Component: NoteRow,
  });
  const removeCommand = client.addCommandCenterItem({
    id: "publish-note",
    title: "Publish review note",
    icon: "NotebookPen",
    context: "agent",
    async onSelect({ agent, rpc }) {
      await rpc(publishNoteRpc, {
        agentId: agent.id,
        noteId: "review-ready",
        label: "Ready for review",
      });
    },
  });

  return () => {
    removeCommand();
    removeRenderer();
  };
}
