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
  AskQuestion,
  AskTimelineData,
} from "../shared/ask-user.ts";
import { answerAskRequestRpc } from "../shared/ask-user.ts";

interface DraftAnswer {
  selectedValues: string[];
  customText: string;
  outOfScope: boolean;
}

function createDraftAnswers(
  questions: AskQuestion[],
): Record<string, DraftAnswer> {
  return Object.fromEntries(
    questions.map((question) => [
      question.id,
      { selectedValues: [], customText: "", outOfScope: false },
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
      input: {
        color: theme.colors.foreground,
        backgroundColor: theme.colors.surface0,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
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
    const statusText =
      item.data.state === TIMELINE_STATE.ANSWERED
        ? "Answered"
        : (item.data.message ?? "Closed");
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Question for you</Text>
        <Text style={styles.status}>{statusText}</Text>
      </View>
    );
  }

  function updateDraft(
    questionId: string,
    update: (draft: DraftAnswer) => DraftAnswer,
  ): void {
    setDrafts((current) => ({
      ...current,
      [questionId]: update(current[questionId]),
    }));
  }

  function chooseOption(question: AskQuestion, value: string): void {
    updateDraft(question.id, (draft) => {
      const selectedValues =
        question.selectionMode === QUESTION_MODE.SINGLE
          ? [value]
          : draft.selectedValues.includes(value)
            ? draft.selectedValues.filter(
                (selectedValue) => selectedValue !== value,
              )
            : [...draft.selectedValues, value];
      return { selectedValues, customText: "", outOfScope: false };
    });
  }

  function submit(): void {
    const answers = item.data.questions.map((question) =>
      toAnswer(question.id, drafts[question.id]),
    );
    answerMutation.mutate({ agentId, requestId: item.data.requestId, answers });
  }

  const canSubmit = item.data.questions.every((question) =>
    isDraftAnswered(drafts[question.id]),
  );
  const activeQuestionIndex = item.data.questions.findIndex(
    (question) => question.id === activeQuestionId,
  );
  const activeQuestion = item.data.questions[activeQuestionIndex];
  const activeDraft = drafts[activeQuestion.id];
  const recommendedOptions = new Set(
    activeQuestion.selectionMode === QUESTION_MODE.SINGLE
      ? [activeQuestion.recommendationIndex]
      : activeQuestion.recommendedIndices,
  );
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Question for you</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {item.data.questions.map((question, questionIndex) => {
          const selected = question.id === activeQuestionId;
          const answered = isDraftAnswered(drafts[question.id]);
          const tabTitle = question.label ?? `Question ${questionIndex + 1}`;
          return (
            <Pressable
              key={question.id}
              accessibilityRole="tab"
              accessibilityLabel={`${tabTitle}, ${answered ? "answered" : "unanswered"}`}
              accessibilityState={{ selected }}
              onPress={() => setActiveQuestionId(question.id)}
              style={[styles.tab, selected && styles.tabSelected]}
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
              accessibilityState={{ checked: selected }}
              onPress={() => chooseOption(activeQuestion, option.value)}
              style={[styles.option, selected && styles.optionSelected]}
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
            </Pressable>
          );
        })}
        <TextInput
          accessibilityLabel={`Custom answer for ${activeQuestion.prompt}`}
          placeholder="Write another answer"
          placeholderTextColor={theme.colors.foregroundMuted}
          value={activeDraft.customText}
          onChangeText={(customText) =>
            updateDraft(activeQuestion.id, () => ({
              selectedValues: [],
              customText,
              outOfScope: false,
            }))
          }
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            updateDraft(activeQuestion.id, () => ({
              selectedValues: [],
              customText: "",
              outOfScope: true,
            }))
          }
          style={[
            styles.action,
            activeDraft.outOfScope && styles.optionSelected,
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
      </View>
      {answerMutation.error ? (
        <Text style={styles.error}>{answerMutation.error.message}</Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            disabled: !canSubmit || answerMutation.isPending,
          }}
          disabled={!canSubmit || answerMutation.isPending}
          onPress={submit}
          style={[
            styles.action,
            styles.submit,
            (!canSubmit || answerMutation.isPending) && { opacity: 0.5 },
          ]}
        >
          <Text style={styles.submitText}>
            {answerMutation.isPending ? "Submitting…" : "Submit answers"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
