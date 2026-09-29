import * as z from "zod";

export const ASK_MCP_SERVER_NAME = "paseo-ask-user";
export const ASK_TOOL_NAME = "paseo_ask_user";
export const ASK_TIMELINE_KIND = "ask-user";
export const ASK_TIMELINE_VERSION = 1;
export const ASK_BROKER_URL_ENV = "PASEO_ASK_USER_BROKER_URL";
export const ASK_BROKER_TOKEN_ENV = "PASEO_ASK_USER_BROKER_TOKEN";

export const QUESTION_MODE = {
  SINGLE: "single",
  MULTIPLE: "multiple",
};

export const ANSWER_KIND = {
  SELECTION: "selection",
  CUSTOM: "custom",
  OUT_OF_SCOPE: "out_of_scope",
};

export const TIMELINE_STATE = {
  PENDING: "pending",
  ANSWERED: "answered",
  TIMED_OUT: "timed_out",
  CANCELED: "canceled",
};

const questionOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1).max(60),
  description: z.string().min(1).optional(),
});

export const askQuestionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1).max(16).optional(),
    prompt: z.string().min(1),
    options: z.array(questionOptionSchema).min(2).max(4),
    selectionMode: z
      .enum([QUESTION_MODE.SINGLE, QUESTION_MODE.MULTIPLE])
      .default(QUESTION_MODE.SINGLE),
    recommendationIndex: z.number().int().nonnegative().optional(),
    recommendedIndices: z
      .array(z.number().int().nonnegative())
      .min(1)
      .optional(),
  })
  .superRefine((question, context) => {
    const optionValues = question.options.map((option) => option.value);
    if (new Set(optionValues).size !== optionValues.length) {
      context.addIssue({
        code: "custom",
        message: "Option values must be unique.",
      });
    }
    if (question.selectionMode === QUESTION_MODE.SINGLE) {
      if (question.recommendationIndex === undefined) {
        context.addIssue({
          code: "custom",
          message: "Single-selection questions require recommendationIndex.",
        });
        return;
      }
      if (question.recommendationIndex >= question.options.length) {
        context.addIssue({
          code: "custom",
          message: "recommendationIndex must reference an option.",
        });
      }
      if (question.recommendedIndices !== undefined) {
        context.addIssue({
          code: "custom",
          message: "Single-selection questions cannot use recommendedIndices.",
        });
      }
      return;
    }
    if (question.recommendedIndices === undefined) {
      context.addIssue({
        code: "custom",
        message: "Multiple-selection questions require recommendedIndices.",
      });
      return;
    }
    if (question.recommendationIndex !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Multiple-selection questions cannot use recommendationIndex.",
      });
    }
    if (
      question.recommendedIndices.some(
        (index) => index >= question.options.length,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "recommendedIndices must reference available options.",
      });
    }
  });

export const askToolInputSchema = z
  .object({ questions: z.array(askQuestionSchema).min(1).max(4) })
  .superRefine(({ questions }, context) => {
    const questionIds = questions.map((question) => question.id);
    if (new Set(questionIds).size !== questionIds.length) {
      context.addIssue({
        code: "custom",
        message: "Question ids must be unique.",
      });
    }
  });

export const askAnswerSchema = z.discriminatedUnion("kind", [
  z.object({
    questionId: z.string().min(1),
    kind: z.literal(ANSWER_KIND.SELECTION),
    values: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    questionId: z.string().min(1),
    kind: z.literal(ANSWER_KIND.CUSTOM),
    text: z.string().trim().min(1),
  }),
  z.object({
    questionId: z.string().min(1),
    kind: z.literal(ANSWER_KIND.OUT_OF_SCOPE),
  }),
]);

export const askAnswersSchema = z.array(askAnswerSchema).min(1).max(4);

export const answerAskRequestInputSchema = z.object({
  agentId: z.string().min(1),
  requestId: z.string().min(1),
  answers: askAnswersSchema,
});

export const answerAskRequestOutputSchema = z.object({
  accepted: z.literal(true),
});

export const askTimelineDataSchema = z.object({
  requestId: z.string().min(1),
  state: z.enum([
    TIMELINE_STATE.PENDING,
    TIMELINE_STATE.ANSWERED,
    TIMELINE_STATE.TIMED_OUT,
    TIMELINE_STATE.CANCELED,
  ]),
  questions: z.array(askQuestionSchema).min(1).max(4),
  answers: askAnswersSchema.optional(),
  message: z.string().min(1).optional(),
});

export const brokerAskResponseSchema = z.object({
  requestId: z.string().min(1),
  answers: askAnswersSchema,
});
