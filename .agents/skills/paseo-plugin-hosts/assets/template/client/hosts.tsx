import {
  getPaseoClient,
  type PluginSurfaceProps,
  useHosts,
} from "@getpaseo/plugin/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { clearHostCache, getCachedCount } from "./cache";

export function HostsSurface({ host, theme, layout }: PluginSurfaceProps) {
  const hosts = useHosts();
  const [result, setResult] = useState("Choose an online host.");
  const requestSequence = useRef(0);
  const styles = useMemo(
    () => ({
      screen: {
        flex: 1,
        gap: 12,
        padding: layout.compact ? 16 : 24,
        backgroundColor: theme.colors.surface0,
      },
      text: { color: theme.colors.foreground },
      muted: { color: theme.colors.foregroundMuted },
      button: {
        padding: 12,
        borderRadius: 8,
        backgroundColor: theme.colors.surface1,
      },
    }),
    [layout.compact, theme],
  );

  useEffect(() => {
    requestSequence.current += 1;
    for (const summary of hosts) {
      if (summary.status !== "online") {
        clearHostCache(summary.serverId);
      }
    }
  }, [hosts, host.id]);

  useEffect(
    () => () => {
      requestSequence.current += 1;
    },
    [],
  );

  async function loadAgentCount(serverId: string): Promise<void> {
    const sequence = ++requestSequence.current;
    const summary = hosts.find((candidate) => candidate.serverId === serverId);
    if (summary?.status !== "online") {
      setResult(`${summary?.label ?? serverId} is disconnected. No failover attempted.`);
      return;
    }

    try {
      const count = await getCachedCount(serverId, "agents:list:all", Date.now(), async () => {
        const paseo = getPaseoClient(serverId);
        const { entries } = await paseo.agents.list();
        return entries.length;
      });
      if (requestSequence.current === sequence) {
        setResult(`${summary.label}: ${count} agents`);
      }
    } catch (error) {
      if (requestSequence.current === sequence) {
        setResult(error instanceof Error ? error.message : String(error));
      }
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.text}>Selected host: {host.label}</Text>
      {hosts.map((summary) => (
        <Pressable
          key={summary.serverId}
          accessibilityRole="button"
          accessibilityLabel={`Load agents from ${summary.label}`}
          disabled={summary.status !== "online"}
          accessibilityState={{ disabled: summary.status !== "online" }}
          onPress={() => void loadAgentCount(summary.serverId)}
          style={styles.button}
        >
          <Text style={styles.text}>
            {summary.serverId === host.id ? "Selected · " : ""}
            {summary.label}
          </Text>
          <Text style={styles.muted}>{summary.status}</Text>
        </Pressable>
      ))}
      <Text style={styles.text}>{result}</Text>
    </View>
  );
}
