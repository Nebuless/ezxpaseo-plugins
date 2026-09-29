import { type PluginSurfaceProps, useSettings } from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsSection,
  SettingsSwitch,
  type SettingsInputHandle,
} from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import type { z } from "zod";
import { preferences } from "../shared/preferences";

type Values = z.output<typeof preferences.schema>;
type Draft = { readonly values: Values; readonly revision: string };

export function SettingsScreen({ layout, theme }: PluginSurfaceProps) {
  const settings = useSettings(preferences);
  const [draft, setDraft] = useState<Draft | null>(null);
  const nameInput = useRef<SettingsInputHandle>(null);
  useEffect(() => {
    if (settings.status === "ready" && draft === null) {
      setDraft({ values: settings.values, revision: settings.revision });
    }
  }, [draft, settings]);

  const styles = useMemo(
    () => ({
      root: {
        gap: layout.compact ? 10 : 16,
        padding: layout.compact ? 12 : 20,
        backgroundColor: theme.colors.surface0,
      },
      status: { color: theme.colors.foregroundMuted },
      error: { color: theme.colors.statusDanger },
    }),
    [layout.compact, theme],
  );

  if (settings.status === "loading") {
    return (
      <View style={styles.root}>
        <Text style={styles.status}>Loading settings…</Text>
      </View>
    );
  }
  if (settings.status === "error") {
    return (
      <View style={styles.root}>
        <Text accessibilityRole="alert" style={styles.error}>
          {settings.error}
        </Text>
        <SettingsAction
          label="Retry"
          actionLabel="Reload"
          onPress={() => void settings.reload()}
        />
      </View>
    );
  }
  if (settings.status === "invalid") {
    return (
      <View style={styles.root}>
        <Text accessibilityRole="alert" style={styles.error}>
          {settings.error}
        </Text>
        <SettingsAction
          label="Stored values"
          actionLabel="Reset to defaults"
          onPress={() => void settings.reset()}
        />
        <SettingsAction
          label="Read again"
          actionLabel="Reload"
          onPress={() => void settings.reload()}
        />
      </View>
    );
  }
  if (!draft) {
    return (
      <View style={styles.root}>
        <Text style={styles.status}>Preparing editor…</Text>
      </View>
    );
  }

  const save = async () => {
    const saved = await settings.save(draft.values, draft.revision);
    if (saved) {
      await settings.reload();
      setDraft(null);
    }
  };
  const discard = () => {
    nameInput.current?.replaceText(settings.values.displayName);
    setDraft({ values: settings.values, revision: settings.revision });
  };

  return (
    <View style={styles.root}>
      <SettingsSection title="Display">
        <SettingsCard>
          <SettingsInput
            ref={nameInput}
            key={draft.revision}
            label="Display name"
            initialValue={draft.values.displayName}
            disabled={settings.saving}
            error={settings.saveError}
            onChangeText={(displayName) =>
              setDraft((current) =>
                current
                  ? { ...current, values: { ...current.values, displayName } }
                  : current,
              )
            }
          />
          <SettingsSwitch
            label="Show hints"
            value={draft.values.showHints}
            disabled={settings.saving}
            onValueChange={(showHints) =>
              setDraft((current) =>
                current
                  ? { ...current, values: { ...current.values, showHints } }
                  : current,
              )
            }
          />
          <SettingsAction
            label="Save this draft"
            actionLabel={settings.saving ? "Saving…" : "Save"}
            disabled={settings.saving}
            onPress={() => void save()}
          />
          <SettingsAction
            label="Discard this draft"
            actionLabel="Discard"
            disabled={settings.saving}
            onPress={discard}
          />
        </SettingsCard>
      </SettingsSection>
      {settings.saveError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {settings.saveError}
        </Text>
      ) : null}
    </View>
  );
}
