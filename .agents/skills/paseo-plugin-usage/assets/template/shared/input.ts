import { z } from "zod";

export const localUsageInputSchema = z.object({
  path: z.string().min(1).max(4096),
  accountRef: z.string().min(1).max(256),
});

export type LocalUsageInput = z.output<typeof localUsageInputSchema>;
