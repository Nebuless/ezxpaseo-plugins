import {
  type PluginAgentPanelProps,
  useAgent,
  useWorkspace,
} from "@getpaseo/plugin/client";
import { useMemo } from "react";
import { Text, View } from "react-native";
import { EMPTY_LABEL } from "../shared/labels";

export function AgentOverview({
  agentId,
  layout,
  theme,
  workspaceId,
}: PluginAgentPanelProps) {
  const workspace = useWorkspace(workspaceId, ({ name, status }) => ({ name, status }));
  const agent = useAgent(agentId, ({ id, provider, status, title }) => ({
    id,
    provider,
    status,
    title,
  }));
  const styles = useMemo(
    () => ({
      screen: {
        flex: 1,
        gap: layout.compact ? 8 : 12,
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
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="alert" style={styles.warning}>{EMPTY_LABEL}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>{agent.title ?? agent.id}</Text>
      <Text style={styles.detail}>Provider: {agent.provider}</Text>
      <Text style={styles.detail}>Agent: {agent.status}</Text>
      <Text style={styles.detail}>Workspace: {workspace.name} ({workspace.status})</Text>
    </View>
  );
}
