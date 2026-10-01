import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { TextInput } from "@getpaseo/plugin/client/react-native";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  ANSWER_KIND,
  QUESTION_MODE,
  TIMELINE_STATE,
} from "../shared/ask-schema.mjs";
import type {
  AskAnswer,
  AskNativeAnswer,
  AskNativeQuestion,
  AskQuestion,
  AskTimelineData,
} from "../shared/ask-user.ts";
import { answerAskRequestRpc } from "../shared/ask-user.ts";

interface DraftAnswer {
  selectedValues: string[];
  customText: string;
  note: string;
  outOfScope: boolean;
}

type AskUiQuestion = AskQuestion | AskNativeQuestion;

function createDraftAnswers(
  questions: AskUiQuestion[],
): Record<string, DraftAnswer> {
  return Object.fromEntries(
    questions.map((question) => [
      question.id,
      { selectedValues: [], customText: "", note: "", outOfScope: false },
    ]),
  );
}

function isDraftAnswered(draft: DraftAnswer): boolean {
  return (
    draft.outOfScope ||
    draft.customText.trim().length > 0 ||
    draft.selectedValues.length > 0
  );
}

function isQuestionAnswered(
  question: AskUiQuestion,
  draft: DraftAnswer,
  native: boolean,
): boolean {
  if (native && question.selectionMode === QUESTION_MODE.MULTIPLE) {
    return true;
  }
  return isDraftAnswered(draft);
}

function toAnswer(questionId: string, draft: DraftAnswer): AskAnswer {
  const customText = draft.customText.trim();
  if (customText.length > 0) {
    return { questionId, kind: ANSWER_KIND.CUSTOM, text: customText };
  }
  if (draft.outOfScope) {
    return { questionId, kind: ANSWER_KIND.OUT_OF_SCOPE };
  }
  if (draft.selectedValues.length === 0) {
    throw new Error(`Question has no answer: ${questionId}`);
  }
  return {
    questionId,
    kind: ANSWER_KIND.SELECTION,
    values: draft.selectedValues,
  };
}

function toNativeAnswer(
  question: AskNativeQuestion,
  draft: DraftAnswer,
): AskNativeAnswer {
  const note = draft.note.trim().length > 0 ? draft.note : undefined;
  const text = draft.customText.trim();
  if (text.length > 0) {
    return {
      questionId: question.id,
      kind: "custom",
      text,
      ...(note && { note }),
    };
  }
  if (
    question.selectionMode === QUESTION_MODE.SINGLE &&
    draft.selectedValues.length === 0
  ) {
    throw new Error(`Question has no answer: ${question.id}`);
  }
  return {
    questionId: question.id,
    kind: "selection",
    values: draft.selectedValues,
    ...(note && { note }),
  };
}

export function AskUserCard({
  agentId,
  item,
  theme,
  layout,
}: PluginTimelineItemProps<AskTimelineData>) {
  const submitAnswers = useRpc(answerAskRequestRpc);
  const [drafts, setDrafts] = useState(() =>
    createDraftAnswers(item.data.questions),
  );
  const [activeQuestionId, setActiveQuestionId] = useState(
    () => item.data.questions[0].id,
  );
  const answerMutation = useMutation({ mutationFn: submitAnswers });
  const styles = useMemo(
    () => ({
      card: {
        gap: layout.compact ? 12 : 16,
        padding: layout.compact ? 14 : 18,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      },
      title: {
        color: theme.colors.foreground,
        fontSize: layout.compact ? 17 : 19,
        fontWeight: "600" as const,
      },
      prompt: { color: theme.colors.foreground, fontSize: 15 },
      label: { color: theme.colors.foregroundMuted, fontSize: 12 },
      tabs: { gap: 8, paddingBottom: 4 },
      tab: {
        minWidth: layout.compact ? 104 : 128,
        gap: 2,
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface2,
      },
      tabSelected: {
        backgroundColor: theme.colors.accent,
        borderColor: theme.colors.accent,
      },
      tabText: { color: theme.colors.foreground, fontWeight: "600" as const },
      tabTextSelected: { color: theme.colors.accentForeground },
      tabStatus: { color: theme.colors.foregroundMuted, fontSize: 11 },
      tabStatusSelected: { color: theme.colors.accentForeground },
      option: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
      optionSelected: {
        backgroundColor: theme.colors.accent,
        borderColor: theme.colors.accent,
      },
      optionText: { color: theme.colors.foreground },
      optionTextSelected: { color: theme.colors.accentForeground },
      description: { color: theme.colors.foregroundMuted, marginTop: 3 },
      preview: {
        color: theme.colors.foregroundMuted,
        marginTop: 8,
        fontSize: layout.compact ? 12 : 13,
      },
      input: {
        color: theme.colors.foreground,
        backgroundColor: theme.colors.surface0,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
      },
      noteInput: {
        minHeight: layout.compact ? 64 : 80,
        textAlignVertical: "top" as const,
      },
      actions: {
        flexDirection: "row" as const,
        gap: 8,
        flexWrap: "wrap" as const,
      },
      action: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: theme.colors.surface2,
      },
      submit: { backgroundColor: theme.colors.accent },
      actionText: { color: theme.colors.foreground },
      submitText: {
        color: theme.colors.accentForeground,
        fontWeight: "600" as const,
      },
      error: { color: theme.colors.statusDanger },
      status: { color: theme.colors.foregroundMuted },
    }),
    [layout.compact, theme],
  );

  if (item.data.state !== TIMELINE_STATE.PENDING) {
    const action =
      "protocol" in item.data && item.data.protocol === "omp"
        ? item.data.action
        : undefined;
    const statusText =
      action === "submit"
        ? "Answers submitted"
        : action === "chat"
          ? "Chat about this requested"
          : action === "cancel"
            ? "Questionnaire canceled"
            : action === "timeout" ||
                item.data.state === TIMELINE_STATE.TIMED_OUT
              ? "Question timed out"
              : item.data.state === TIMELINE_STATE.CANCELED
                ? "Questionnaire canceled"
                : item.data.state === TIMELINE_STATE.ANSWERED
                  ? "Answered"
                  : "Questionnaire closed";
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Question for you</Text>
        <Text style={styles.status}>{statusText}</Text>
        {item.data.message ? (
          <Text style={styles.status}>{item.data.message}</Text>
        ) : null}
      </View>
    );
  }

  const native = "protocol" in item.data && item.data.protocol === "omp";
  const questions = item.data.questions;
  const pending = answerMutation.isPending;
  const pendingAction =
    answerMutation.variables && "action" in answerMutation.variables
      ? answerMutation.variables.action
      : "submit";

  function updateDraft(
    questionId: string,
    update: (draft: DraftAnswer) => DraftAnswer,
  ): void {
    setDrafts((current) => ({
      ...current,
      [questionId]: update(current[questionId]),
    }));
  }

  function chooseOption(question: AskUiQuestion, value: string): void {
    updateDraft(question.id, (draft) => {
      const selectedValues =
        question.selectionMode === QUESTION_MODE.SINGLE
          ? [value]
          : draft.selectedValues.includes(value)
            ? draft.selectedValues.filter(
                (selectedValue) => selectedValue !== value,
              )
            : [...draft.selectedValues, value];
      return { ...draft, selectedValues, customText: "", outOfScope: false };
    });
  }

  function submit(): void {
    if ("protocol" in item.data && item.data.protocol === "omp") {
      const answers = item.data.questions.map((question) =>
        toNativeAnswer(question, drafts[question.id]),
      );
      answerMutation.mutate({
        agentId,
        requestId: item.data.requestId,
        action: "submit",
        answers,
      });
      return;
    }
    const answers = item.data.questions.map((question) =>
      toAnswer(question.id, drafts[question.id]),
    );
    answerMutation.mutate({ agentId, requestId: item.data.requestId, answers });
  }

  function sendAction(action: "chat" | "cancel"): void {
    answerMutation.mutate({
      agentId,
      requestId: item.data.requestId,
      action,
    });
  }

  const canSubmit = questions.every((question) =>
    isQuestionAnswered(question, drafts[question.id], native),
  );
  const activeQuestionIndex = questions.findIndex(
    (question) => question.id === activeQuestionId,
  );
  const activeQuestion = item.data.questions[activeQuestionIndex];
  const activeDraft = drafts[activeQuestion.id];
  const recommendedOptions = new Set(
    "recommendedIndices" in activeQuestion
      ? (activeQuestion.recommendedIndices ?? [])
      : activeQuestion.recommendationIndex === undefined
        ? []
        : [activeQuestion.recommendationIndex],
  );
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Question for you</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {questions.map((question, questionIndex) => {
          const selected = question.id === activeQuestionId;
          const answered = isQuestionAnswered(
            question,
            drafts[question.id],
            native,
          );
          const tabTitle = question.label ?? `Question ${questionIndex + 1}`;
          return (
            <Pressable
              key={question.id}
              accessibilityRole="tab"
              accessibilityLabel={`${tabTitle}, ${answered ? "answered" : "unanswered"}`}
              accessibilityState={{ selected, disabled: pending }}
              disabled={pending}
              onPress={() => setActiveQuestionId(question.id)}
              style={[
                styles.tab,
                selected && styles.tabSelected,
                pending && { opacity: 0.5 },
              ]}
            >
              <Text
                style={[styles.tabText, selected && styles.tabTextSelected]}
              >
                {tabTitle}
              </Text>
              <Text
                style={[styles.tabStatus, selected && styles.tabStatusSelected]}
              >
                {answered ? "Answered" : "Needs answer"}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>
          Question {activeQuestionIndex + 1} of {item.data.questions.length}
        </Text>
        <Text style={styles.prompt}>{activeQuestion.prompt}</Text>
        {native && activeQuestion.options.length === 0 ? (
          <Text style={styles.status}>
            No options available. Write a custom answer.
          </Text>
        ) : null}
        {activeQuestion.options.map((option, optionIndex) => {
          const selected = activeDraft.selectedValues.includes(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole={
                activeQuestion.selectionMode === QUESTION_MODE.SINGLE
                  ? "radio"
                  : "checkbox"
              }
              accessibilityLabel={`${option.label}${recommendedOptions.has(optionIndex) ? ", recommended" : ""}`}
              accessibilityHint={
                [
                  option.description,
                  "preview" in option ? option.preview : undefined,
                ]
                  .filter(Boolean)
                  .join(". ") || undefined
              }
              accessibilityState={{ checked: selected, disabled: pending }}
              disabled={pending}
              onPress={() => chooseOption(activeQuestion, option.value)}
              style={[
                styles.option,
                selected && styles.optionSelected,
                pending && { opacity: 0.5 },
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  selected && styles.optionTextSelected,
                ]}
              >
                {option.label}
                {recommendedOptions.has(optionIndex) ? " (recommended)" : ""}
              </Text>
              {option.description ? (
                <Text style={styles.description}>{option.description}</Text>
              ) : null}
              {"preview" in option && option.preview ? (
                <Text style={styles.preview}>{option.preview}</Text>
              ) : null}
            </Pressable>
          );
        })}
        <TextInput
          accessibilityLabel={`Custom answer for ${activeQuestion.prompt}`}
          accessibilityState={{ disabled: pending }}
          placeholder="Write another answer"
          placeholderTextColor={theme.colors.foregroundMuted}
          value={activeDraft.customText}
          editable={!pending}
          onChangeText={(customText) =>
            updateDraft(activeQuestion.id, (draft) => ({
              ...draft,
              selectedValues: [],
              customText,
              outOfScope: false,
            }))
          }
          style={styles.input}
        />
        {native ? (
          <TextInput
            accessibilityLabel={`Note for ${activeQuestion.prompt}`}
            accessibilityState={{ disabled: pending }}
            placeholder="Add a note (optional)"
            placeholderTextColor={theme.colors.foregroundMuted}
            value={activeDraft.note}
            editable={!pending}
            multiline
            onChangeText={(note) =>
              updateDraft(activeQuestion.id, (draft) => ({ ...draft, note }))
            }
            style={[styles.input, styles.noteInput]}
          />
        ) : null}
        {!native ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: pending }}
            disabled={pending}
            onPress={() =>
              updateDraft(activeQuestion.id, (draft) => ({
                ...draft,
                selectedValues: [],
                customText: "",
                outOfScope: true,
              }))
            }
            style={[
              styles.action,
              activeDraft.outOfScope && styles.optionSelected,
              pending && { opacity: 0.5 },
            ]}
          >
            <Text
              style={
                activeDraft.outOfScope
                  ? styles.optionTextSelected
                  : styles.actionText
              }
            >
              Out of scope
            </Text>
          </Pressable>
        ) : null}
      </View>
      {answerMutation.error ? (
        <Text style={styles.error}>{answerMutation.error.message}</Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            disabled: !canSubmit || pending,
          }}
          disabled={!canSubmit || pending}
          onPress={submit}
          style={[
            styles.action,
            styles.submit,
            (!canSubmit || pending) && { opacity: 0.5 },
          ]}
        >
          <Text style={styles.submitText}>
            {pending && pendingAction === "submit"
              ? "Submitting…"
              : "Submit answers"}
          </Text>
        </Pressable>
        {native ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chat about this"
            accessibilityState={{ disabled: pending }}
            disabled={pending}
            onPress={() => sendAction("chat")}
            style={[styles.action, pending && { opacity: 0.5 }]}
          >
            <Text style={styles.actionText}>
              {pending && pendingAction === "chat"
                ? "Opening chat…"
                : "Chat about this"}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel questionnaire"
          accessibilityState={{ disabled: pending }}
          disabled={pending}
          onPress={() => sendAction("cancel")}
          style={[styles.action, pending && { opacity: 0.5 }]}
        >
          <Text style={styles.actionText}>
            {pending && pendingAction === "cancel"
              ? "Canceling…"
              : "Cancel questionnaire"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
