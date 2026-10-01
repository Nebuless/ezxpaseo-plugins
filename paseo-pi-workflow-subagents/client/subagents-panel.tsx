import type { PluginAgentPanelProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type {
  SubagentStatus,
  WatchSubagentsInput,
} from "../shared/subagents.ts";
import { watchWorkflowSubagentsRpc } from "../shared/subagents.ts";
import {
  applyWatchResponse,
  createPanelState,
  formatAgentState,
  subagentStatusKey,
} from "./panel-state.mjs";

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

function activityDescription(status: SubagentStatus): string | null {
  if (!status.toolName) return null;
  return status.toolState
    ? "Tool: " + status.toolName + " · " + status.toolState
    : "Tool: " + status.toolName;
}

function compareStatuses(left: SubagentStatus, right: SubagentStatus): number {
  const sourceOrder = left.source.localeCompare(right.source);
  if (sourceOrder !== 0) return sourceOrder;
  const leftRun = left.source === "workflow" ? left.runId : "";
  const rightRun = right.source === "workflow" ? right.runId : "";
  return (
    leftRun.localeCompare(rightRun) ||
    (left.label ?? left.agentId).localeCompare(right.label ?? right.agentId)
  );
}

function SubagentsPanelForAgent({
  agentId,
  theme,
  layout,
}: PluginAgentPanelProps) {
  const watch = useRpc(watchWorkflowSubagentsRpc);
  const watchRef = useRef(watch);
  watchRef.current = watch;
  const [panelState, setPanelState] = useState(createPanelState);
  const [connection, setConnection] = useState<
    "connecting" | "connected" | "reconnecting"
  >("connecting");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelRetryDelay: (() => void) | undefined;
    let current = createPanelState();

    const waitToRetry = (delay: number) =>
      new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(retryTimer);
          retryTimer = undefined;
          cancelRetryDelay = undefined;
          resolve();
        };
        retryTimer = setTimeout(finish, delay);
        cancelRetryDelay = finish;
      });

    const watchUntilUnmounted = async () => {
      while (active) {
        try {
          const input: WatchSubagentsInput = { parentAgentId: agentId };
          if (current.piSessionId !== null) {
            input.piSessionId = current.piSessionId;
          }
          if (current.cursor !== undefined) input.cursor = current.cursor;

          const response = await watchRef.current(input);
          if (!active) return;
          if (response.parentAgentId !== agentId) {
            throw new Error("Sub-agent watch returned a different parent.");
          }

          current = applyWatchResponse(current, response, agentId);
          setPanelState(current);
          setConnection("connected");
          retries = 0;
          if (response.availability === "unavailable") {
            await waitToRetry(1_000);
          }
        } catch {
          if (!active) return;
          retries += 1;
          setConnection("reconnecting");
          if (current.availability === "connected") {
            current = { ...current, availability: "stale" };
            setPanelState(current);
          }

          const delay = Math.min(1_000 * 2 ** Math.min(retries - 1, 4), 10_000);
          await waitToRetry(delay);
        }
      }
    };

    void watchUntilUnmounted();
    return () => {
      active = false;
      cancelRetryDelay?.();
    };
  }, [agentId]);

  const statuses = useMemo(
    () => [...panelState.agents.values()].sort(compareStatuses),
    [panelState.agents],
  );
  const styles = useMemo(
    () => ({
      screen: {
        flex: 1,
        gap: layout.compact ? 10 : 14,
        padding: layout.compact ? 12 : 18,
        backgroundColor: theme.colors.surface0,
      },
      title: {
        color: theme.colors.foreground,
        fontSize: layout.compact ? 18 : 21,
        fontWeight: "600" as const,
      },
      message: { color: theme.colors.foregroundMuted, fontSize: 13 },
      warning: { color: theme.colors.foreground, fontSize: 13 },
      list: { flex: 1 },
      listContent: { gap: 8, paddingBottom: 12 },
      row: {
        gap: 5,
        padding: layout.compact ? 10 : 13,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      },
      rowHeading: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        gap: 10,
      },
      name: {
        flex: 1,
        color: theme.colors.foreground,
        fontSize: 14,
        fontWeight: "600" as const,
      },
      state: {
        color: theme.colors.foreground,
        fontSize: 12,
        fontWeight: "600" as const,
      },
      detail: { color: theme.colors.foregroundMuted, fontSize: 12 },
      expanded: {
        gap: 4,
        marginTop: 3,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
      },
    }),
    [layout.compact, theme],
  );

  let connectionMessage: string;
  if (connection === "connecting") {
    connectionMessage = "Connecting to the Pi companion…";
  } else if (connection === "reconnecting") {
    connectionMessage = panelState.hasResponse
      ? "Connection interrupted. Reconnecting; last-known statuses may be stale."
      : "Unable to reach the monitoring service. Retrying…";
  } else if (panelState.availability === "unsupported") {
    connectionMessage =
      "This Pi workflow integration is unsupported; live monitoring is unavailable.";
  } else if (panelState.availability === "unavailable") {
    connectionMessage = "Monitoring is unavailable for this Pi session.";
  } else if (panelState.availability === "stale") {
    connectionMessage =
      "The companion is stale. Last-known statuses are not confirmed live.";
  } else if (panelState.availability === "connected") {
    connectionMessage = "Connected to the Pi companion.";
  } else {
    connectionMessage = "Waiting for a Pi companion session.";
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Sub-agents</Text>
      <Text style={styles.message} accessibilityLiveRegion="polite">
        {connectionMessage}
      </Text>
      {panelState.gapDetected ? (
        <Text style={styles.warning} accessibilityLiveRegion="polite">
          Some intermediate updates were missed. Showing the latest available
          snapshot.
        </Text>
      ) : null}
      {connection === "connected" &&
      panelState.availability === "connected" &&
      statuses.length === 0 ? (
        <Text style={styles.message}>
          No sub-agents observed in this session yet.
        </Text>
      ) : null}
      {connection === "connected" &&
      panelState.availability !== "connected" &&
      statuses.length === 0 ? (
        <Text style={styles.message}>
          No current sub-agent snapshot is available.
        </Text>
      ) : null}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {statuses.map((status) => {
          const key = subagentStatusKey(status);
          const expanded = expandedKey === key;
          const activity = activityDescription(status);
          const stateLabel = formatAgentState(status.state);
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={
                (status.label ?? status.agentId) + ", " + status.state
              }
              accessibilityHint={
                expanded ? "Hide sub-agent details" : "Show sub-agent details"
              }
              accessibilityState={{ expanded }}
              onPress={() => setExpandedKey(expanded ? null : key)}
            >
              <View style={styles.row}>
                <View style={styles.rowHeading}>
                  <Text style={styles.name} numberOfLines={1}>
                    {status.label ?? status.agentId}
                  </Text>
                  <Text style={styles.state}>{stateLabel}</Text>
                </View>
                <Text style={styles.detail} numberOfLines={1}>
                  {status.source === "workflow"
                    ? "Workflow · run " + status.runId
                    : "Standalone"}
                  {status.role ? " · " + status.role : ""}
                </Text>
                {activity ? (
                  <Text style={styles.detail}>{activity}</Text>
                ) : null}
                <Text style={styles.detail}>
                  Updated {formatTimestamp(status.updatedAt)}
                </Text>
                {expanded ? (
                  <View style={styles.expanded}>
                    <Text style={styles.detail}>
                      Agent ID: {status.agentId}
                    </Text>
                    {status.source === "workflow" ? (
                      <Text style={styles.detail}>Run ID: {status.runId}</Text>
                    ) : null}
                    {status.role ? (
                      <Text style={styles.detail}>Role: {status.role}</Text>
                    ) : null}
                    {status.attempt !== undefined ? (
                      <Text style={styles.detail}>
                        Attempt: {status.attempt}
                      </Text>
                    ) : null}
                    <Text style={styles.detail}>State: {stateLabel}</Text>
                    <Text style={styles.detail}>
                      Last update: {formatTimestamp(status.updatedAt)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function AgentSubagentsPanel(props: PluginAgentPanelProps) {
  return <SubagentsPanelForAgent key={props.agentId} {...props} />;
}
