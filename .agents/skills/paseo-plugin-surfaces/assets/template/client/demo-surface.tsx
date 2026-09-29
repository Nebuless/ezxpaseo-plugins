import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { DEMO_LABEL } from "../shared/demo";

export function DemoSurface({ host, layout, theme }: PluginSurfaceProps) {
  const [count, setCount] = useState(0);
  const styles = useMemo(
    () => ({
      screen: {
        flex: 1,
        gap: layout.compact ? 10 : 16,
        padding: layout.compact ? 16 : 24,
        backgroundColor: theme.colors.surface0,
      },
      title: {
        color: theme.colors.foreground,
        fontSize: layout.compact ? 20 : 26,
      },
      detail: { color: theme.colors.foregroundMuted },
      button: {
        padding: layout.compact ? 12 : 14,
        borderRadius: 10,
        backgroundColor: theme.colors.accent,
      },
      buttonText: { color: theme.colors.accentForeground },
    }),
    [layout.compact, theme],
  );

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {DEMO_LABEL}
      </Text>
      <Text style={styles.detail}>
        Connected to {host.label}. Count: {count}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increment demo count, currently ${count}`}
        onPress={() => setCount((value) => value + 1)}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Increment count</Text>
      </Pressable>
    </View>
  );
}
