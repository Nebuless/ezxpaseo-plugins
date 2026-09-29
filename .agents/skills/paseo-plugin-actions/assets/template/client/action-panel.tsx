import {
  type PluginAgentPanelProps,
  useAgent,
  useWorkspace,
} from "@getpaseo/plugin/client";
import { useMemo } from "react";
import { Text, View } from "react-native";
import { PANEL_DESCRIPTION } from "../shared/labels";

export function ActionPanel({ agentId, layout, theme, workspaceId }: PluginAgentPanelProps) {
  const workspace = useWorkspace(workspaceId, ({ name }) => ({ name }));
  const agent = useAgent(agentId, ({ id, title }) => ({ id, title }));
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
      warning: { color: theme.colors.statusWarning },
    }),
    [layout.compact, theme],
  );

  if (!workspace || !agent) {
    return <View style={styles.root}><Text style={styles.warning}>Context unavailable.</Text></View>;
  }
  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" style={styles.title}>{agent.title ?? agent.id}</Text>
      <Text style={styles.detail}>{PANEL_DESCRIPTION}</Text>
      <Text style={styles.detail}>Workspace: {workspace.name}</Text>
    </View>
  );
}
