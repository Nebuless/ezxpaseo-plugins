import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import type { z } from "zod";
import { Text } from "react-native";
import { noteDataSchema } from "../shared/note";

export function NoteRow({
  item,
  theme,
}: PluginTimelineItemProps<z.output<typeof noteDataSchema>>) {
  return <Text style={{ color: theme.colors.foreground }}>{item.data.label}</Text>;
}
