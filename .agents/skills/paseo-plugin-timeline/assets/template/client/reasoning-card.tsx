import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useRevealedText } from "@getpaseo/plugin/client/react-native";
import { useMemo } from "react";
import { Text, View } from "react-native";
import type { z } from "zod";
import { reasoningCardSchema } from "../shared/reasoning-card";

type ReasoningData = z.output<typeof reasoningCardSchema>;

export function ReasoningCard({
  item,
  layout,
  theme,
}: PluginTimelineItemProps<ReasoningData>) {
  const text = useRevealedText(item.data.text, item.data.phase);
  const styles = useMemo(
    () => ({
      card: {
        gap: 6,
        padding: layout.compact ? 10 : 14,
        borderRadius: 10,
        backgroundColor: theme.colors.surface1,
      },
      label: { color: theme.colors.foregroundMuted },
      text: { color: theme.colors.foreground },
    }),
    [layout.compact, theme],
  );
  return (
    <View accessibilityLabel="Agent reasoning" style={styles.card}>
      <Text style={styles.label}>
        {item.data.phase === "streaming" ? "Thinking…" : "Reasoning"}
      </Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}
