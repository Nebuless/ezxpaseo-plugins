import type {
  PluginAgentPanelProps,
  PluginClientContext,
} from "@getpaseo/plugin/client";
import { useEffect, useId, useMemo } from "react";
import { Text, View } from "react-native";
import { PANEL_COPY } from "../shared/labels";

export function createButtonsPanel(client: PluginClientContext) {
  return function ButtonsPanel({
    agentId,
    layout,
    theme,
    workspaceId,
  }: PluginAgentPanelProps) {
    const instanceId = `button-demo-${useId().replace(/[^a-z0-9-]/g, "")}`;
    useEffect(() => {
      const openPanel = () => client.openPanel("button-demo", { workspaceId, agentId });
      const header = client.addHeaderButton({
        id: instanceId,
        workspaceId,
        button: {
          title: "Open button demo",
          icon: "MousePointerClick",
          label: "Buttons",
          behavior: { kind: "action", onPress: openPanel },
        },
      });
      const pill = client.addComposerPill({
        id: instanceId,
        workspaceId,
        agentId,
        button: {
          title: "Open button demo",
          icon: "MousePointerClick",
          label: "Buttons",
          behavior: { kind: "action", onPress: openPanel },
        },
      });
      return () => {
        pill.remove();
        header.remove();
      };
    }, [agentId, workspaceId, instanceId]);

    const styles = useMemo(
      () => ({
        root: {
          flex: 1,
          gap: 8,
          padding: layout.compact ? 16 : 24,
          backgroundColor: theme.colors.surface0,
        },
        title: { color: theme.colors.foreground, fontSize: layout.compact ? 20 : 24 },
        detail: { color: theme.colors.foregroundMuted },
      }),
      [layout.compact, theme],
    );

    return (
      <View style={styles.root}>
        <Text accessibilityRole="header" style={styles.title}>Button registrations</Text>
        <Text style={styles.detail}>{PANEL_COPY}</Text>
      </View>
    );
  };
}
