import type { PluginClientContext } from "@getpaseo/plugin/client";
import { AskUserCard } from "./client/ask-user-card";
import {
  ASK_TIMELINE_KIND,
  ASK_TIMELINE_VERSION,
  askTimelineDataSchema,
} from "./shared/ask-schema.mjs";

export default function contribute(client: PluginClientContext) {
  client.addTimelineRenderer({
    kind: ASK_TIMELINE_KIND,
    version: ASK_TIMELINE_VERSION,
    schema: askTimelineDataSchema,
    Component: AskUserCard,
  });
  return () => {};
}
