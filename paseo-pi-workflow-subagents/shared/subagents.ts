import { defineRpc } from "@getpaseo/plugin";
import type { z } from "zod";
import {
  agentSourceSchema,
  agentStateSchema,
  agentStatusSchema,
  companionMessageSchema,
  monitoringAvailabilitySchema,
  sequencedAgentStatusSchema,
  standaloneAgentStatusSchema,
  subagentSnapshotSchema,
  unsupportedCodeSchema,
  watchSubagentsInputSchema,
  watchSubagentsOutputSchema,
  workflowAgentStatusSchema,
} from "./subagent-schema.mjs";

export {
  AGENT_SOURCE,
  AGENT_STATE,
  MAX_AGENT_COUNT,
  MAX_AGENT_ATTEMPT,
  MAX_IDENTIFIER_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_ROLE_LENGTH,
  MAX_STATUS_BUFFER_LENGTH,
  MAX_TOOL_NAME_LENGTH,
  MAX_WATCH_UPDATE_COUNT,
  MONITORING_AVAILABILITY,
  PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN_ENV,
  PI_WORKFLOW_SUBAGENTS_BRIDGE_URL_ENV,
  PI_WORKFLOW_SUBAGENTS_PLUGIN_ID,
  PI_WORKFLOW_SUBAGENTS_PROTOCOL_VERSION,
  TOOL_STATE,
  UNSUPPORTED_CODE,
  WATCH_LONG_POLL_TIMEOUT_MS,
  agentSourceSchema,
  agentStateSchema,
  agentStatusSchema,
  companionMessageSchema,
  monitoringAvailabilitySchema,
  sequencedAgentStatusSchema,
  standaloneAgentStatusSchema,
  subagentSnapshotSchema,
  unsupportedCodeSchema,
  watchSubagentsInputSchema,
  watchSubagentsOutputSchema,
  workflowAgentStatusSchema,
} from "./subagent-schema.mjs";

export type AgentSource = z.output<typeof agentSourceSchema>;
export type AgentState = z.output<typeof agentStateSchema>;
export type AgentAvailability = z.output<typeof monitoringAvailabilitySchema>;
export type UnsupportedCode = z.output<typeof unsupportedCodeSchema>;
export type WorkflowAgentStatus = z.output<typeof workflowAgentStatusSchema>;
export type StandaloneAgentStatus = z.output<
  typeof standaloneAgentStatusSchema
>;
export type SubagentStatus = z.output<typeof agentStatusSchema>;
export type CompanionMessage = z.output<typeof companionMessageSchema>;
export type SequencedAgentStatus = z.output<typeof sequencedAgentStatusSchema>;
export type SubagentSnapshot = z.output<typeof subagentSnapshotSchema>;
export type WatchSubagentsInput = z.output<typeof watchSubagentsInputSchema>;
export type WatchSubagentsOutput = z.output<typeof watchSubagentsOutputSchema>;

export const watchWorkflowSubagentsRpc = defineRpc({
  name: "workflow_subagents.watch",
  input: watchSubagentsInputSchema,
  output: watchSubagentsOutputSchema,
});
