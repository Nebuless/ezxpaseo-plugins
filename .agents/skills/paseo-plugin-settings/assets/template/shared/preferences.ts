import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const preferences = defineSettings({
  id: "preferences",
  scope: "host",
  version: 1,
  schema: z.object({
    displayName: z.string().trim().min(1).max(40).default("Paseo user"),
    showHints: z.boolean().default(true),
  }),
});
