import { z } from "zod";

export const reasoningCardSchema = z.object({
  text: z.string(),
  phase: z.enum(["streaming", "complete"]),
});
