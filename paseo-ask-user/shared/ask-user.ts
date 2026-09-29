import { defineRpc } from "@getpaseo/plugin";
import type { z } from "zod";
import {
  answerAskRequestInputSchema,
  answerAskRequestOutputSchema,
  askAnswerSchema,
  askQuestionSchema,
  askTimelineDataSchema,
  askToolInputSchema,
} from "./ask-schema.mjs";

export type AskQuestion = z.output<typeof askQuestionSchema>;
export type AskToolInput = z.output<typeof askToolInputSchema>;
export type AskAnswer = z.output<typeof askAnswerSchema>;
export type AskTimelineData = z.output<typeof askTimelineDataSchema>;
export type AnswerAskRequestInput = z.output<
  typeof answerAskRequestInputSchema
>;

export const answerAskRequestRpc = defineRpc({
  name: "ask_user.answer",
  input: answerAskRequestInputSchema,
  output: answerAskRequestOutputSchema,
});
