import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const noteDataSchema = z.object({
  label: z.string().min(1).max(120),
});

export const publishNoteRpc = defineRpc({
  name: "notes.publish",
  input: z.object({
    agentId: z.string().min(1).max(128),
    noteId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    label: z.string().trim().min(1).max(120),
  }),
  output: z.object({
    itemId: z.string().min(1).max(80),
  }),
});
