import type { PluginClientContext } from "@getpaseo/plugin/client";
import { ReasoningCard } from "./client/reasoning-card";
import { reasoningCardSchema } from "./shared/reasoning-card";

export default function contribute(client: PluginClientContext) {
  const removeTransformer = client.addTimelineTransformer({
    id: "reasoning-card",
    query: { itemType: "reasoning" },
    transform({ item, phase }) {
      return {
        items: [{
          type: "plugin",
          kind: "reasoning-card",
          version: 1,
          data: { text: item.text, phase },
        }],
      };
    },
  });
  const removeRenderer = client.addTimelineRenderer({
    kind: "reasoning-card",
    version: 1,
    schema: reasoningCardSchema,
    Component: ReasoningCard,
  });

  return () => {
    removeRenderer();
    removeTransformer();
  };
}
