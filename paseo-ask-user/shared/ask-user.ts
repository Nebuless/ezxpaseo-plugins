import { defineRpc } from "@getpaseo/plugin";
import type { z } from "zod";
import {
  answerAskRequestInputSchema,
  answerAskRequestOutputSchema,
  askAnswerSchema,
  askNativeAnswerSchema,
  askNativeDialogInputSchema,
  askNativeOptionSchema,
  askNativeQuestionSchema,
  askQuestionSchema,
  askTimelineDataSchema,
  askToolInputSchema,
} from "./ask-schema.mjs";

export type AskQuestion = z.output<typeof askQuestionSchema>;
export type AskToolInput = z.output<typeof askToolInputSchema>;
export type AskAnswer = z.output<typeof askAnswerSchema>;
export type AskNativeOption = z.output<typeof askNativeOptionSchema>;
export type AskNativeQuestion = z.output<typeof askNativeQuestionSchema>;
export type AskNativeDialogInput = z.output<typeof askNativeDialogInputSchema>;
export type AskNativeAnswer = z.output<typeof askNativeAnswerSchema>;
export type AskTimelineData = z.output<typeof askTimelineDataSchema>;
export type AnswerAskRequestInput = z.output<
  typeof answerAskRequestInputSchema
>;

export const answerAskRequestRpc = defineRpc({
  name: "ask_user.answer",
  input: answerAskRequestInputSchema,
  output: answerAskRequestOutputSchema,
});
