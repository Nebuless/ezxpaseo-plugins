import type { PluginThemeContribution } from "@getpaseo/plugin";

// Hardcoded hex values are required theme data. UI components must use derived theme tokens.
export const CALM_NIGHT = {
  id: "calm-night",
  name: "Calm Night",
  appearance: "dark",
  colors: {
    background: "#111827",
    foreground: "#F3F4F6",
    raised: "#1F2937",
    control: "#374151",
    border: "#4B5563",
    accent: "#38BDF8",
    mutedForeground: "#CBD5E1",
    ring: "#7DD3FC",
  },
} satisfies PluginThemeContribution;
