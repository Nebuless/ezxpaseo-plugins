import * as z from "zod";

export const PI_WORKFLOW_SUBAGENTS_PLUGIN_ID = "paseo-pi-workflow-subagents";
export const PI_WORKFLOW_SUBAGENTS_BRIDGE_URL_ENV =
  "PASEO_PI_WORKFLOW_SUBAGENTS_BRIDGE_URL";
export const PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN_ENV =
  "PASEO_PI_WORKFLOW_SUBAGENTS_BRIDGE_TOKEN";
/** @type {1} */
export const PI_WORKFLOW_SUBAGENTS_PROTOCOL_VERSION = 1;

export const MAX_IDENTIFIER_LENGTH = 128;
export const MAX_LABEL_LENGTH = 80;
export const MAX_ROLE_LENGTH = 48;
export const MAX_TOOL_NAME_LENGTH = 64;
export const MAX_AGENT_ATTEMPT = 1_000;
export const MAX_AGENT_COUNT = 256;
export const MAX_WATCH_UPDATE_COUNT = 256;
export const MAX_STATUS_BUFFER_LENGTH = 256;
export const WATCH_LONG_POLL_TIMEOUT_MS = 25_000;

/** @type {{ readonly WORKFLOW: "workflow", readonly STANDALONE: "standalone" }} */
export const AGENT_SOURCE = {
  WORKFLOW: "workflow",
  STANDALONE: "standalone",
};

/**
 * @type {{
 *   readonly QUEUED: "queued",
 *   readonly PENDING: "pending",
 *   readonly RUNNING: "running",
 *   readonly WAITING_FOR_CHILD: "waiting_for_child",
 *   readonly PAUSED: "paused",
 *   readonly RETRYING: "retrying",
 *   readonly COMPLETED: "completed",
 *   readonly FAILED: "failed",
 *   readonly CANCELLED: "cancelled",
 *   readonly STOPPED: "stopped",
 *   readonly UNKNOWN: "unknown"
 * }}
 */
export const AGENT_STATE = {
  QUEUED: "queued",
  PENDING: "pending",
  RUNNING: "running",
  WAITING_FOR_CHILD: "waiting_for_child",
  PAUSED: "paused",
  RETRYING: "retrying",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  STOPPED: "stopped",
  UNKNOWN: "unknown",
};

/** @type {{ readonly RUNNING: "running", readonly COMPLETED: "completed", readonly FAILED: "failed" }} */
export const TOOL_STATE = {
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
};

/** @type {{ readonly CONNECTED: "connected", readonly STALE: "stale", readonly UNAVAILABLE: "unavailable", readonly UNSUPPORTED: "unsupported" }} */
export const MONITORING_AVAILABILITY = {
  CONNECTED: "connected",
  STALE: "stale",
  UNAVAILABLE: "unavailable",
  UNSUPPORTED: "unsupported",
};

/** @type {{ readonly MISSING_REGISTRY_OBSERVER: "missing-registry-observer", readonly MISSING_WORKFLOW_EVENTS: "missing-workflow-events", readonly UNSUPPORTED_WORKFLOW_VERSION: "unsupported-workflow-version", readonly PROTOCOL_MISMATCH: "protocol-mismatch", readonly COMPANION_ERROR: "companion-error" }} */
export const UNSUPPORTED_CODE = {
  MISSING_REGISTRY_OBSERVER: "missing-registry-observer",
  MISSING_WORKFLOW_EVENTS: "missing-workflow-events",
  UNSUPPORTED_WORKFLOW_VERSION: "unsupported-workflow-version",
  PROTOCOL_MISMATCH: "protocol-mismatch",
  COMPANION_ERROR: "companion-error",
};

const idSchema = z
  .string()
  .min(1)
  .max(MAX_IDENTIFIER_LENGTH)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
/** @param {number} maxLength */
const safeDisplayText = (maxLength) =>
  z
    .string()
    .min(1)
    .max(maxLength)
    .refine(
      (value) =>
        value.trim().length > 0 && !/[\u0000-\u001f\u007f]/u.test(value),
    );
const timestampSchema = z.iso.datetime();
const stateSchema = z.enum(AGENT_STATE);
const optionalStatusFields = {
  label: safeDisplayText(MAX_LABEL_LENGTH).optional(),
  role: safeDisplayText(MAX_ROLE_LENGTH).optional(),
  toolName: safeDisplayText(MAX_TOOL_NAME_LENGTH)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/)
    .optional(),
  toolState: z.enum(TOOL_STATE).optional(),
  attempt: z.number().int().nonnegative().max(MAX_AGENT_ATTEMPT).optional(),
  state: stateSchema,
  updatedAt: timestampSchema,
};

export const agentSourceSchema = z.enum(AGENT_SOURCE);
export const agentStateSchema = stateSchema;
export const monitoringAvailabilitySchema = z.enum(MONITORING_AVAILABILITY);
export const unsupportedCodeSchema = z.enum(UNSUPPORTED_CODE);

export const workflowAgentStatusSchema = z.strictObject({
  piSessionId: idSchema,
  source: z.literal(AGENT_SOURCE.WORKFLOW),
  runId: idSchema,
  agentId: idSchema,
  ...optionalStatusFields,
});

export const standaloneAgentStatusSchema = z.strictObject({
  piSessionId: idSchema,
  source: z.literal(AGENT_SOURCE.STANDALONE),
  agentId: idSchema,
  ...optionalStatusFields,
});

export const agentStatusSchema = z.discriminatedUnion("source", [
  workflowAgentStatusSchema,
  standaloneAgentStatusSchema,
]);

export const companionMessageSchema = z
  .discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("hello"),
      piSessionId: idSchema,
      protocolVersion: z.literal(PI_WORKFLOW_SUBAGENTS_PROTOCOL_VERSION),
    }),
    z.strictObject({
      type: z.literal("heartbeat"),
      piSessionId: idSchema,
    }),
    z.strictObject({
      type: z.literal("update"),
      piSessionId: idSchema,
      status: agentStatusSchema,
    }),
    z.strictObject({
      type: z.literal("unsupported"),
      piSessionId: idSchema,
      code: unsupportedCodeSchema,
    }),
  ])
  .superRefine((message, context) => {
    if (
      message.type === "update" &&
      message.piSessionId !== message.status.piSessionId
    ) {
      context.addIssue({
        code: "custom",
        path: ["status", "piSessionId"],
        message: "Update session identity must match its status.",
      });
    }
  });

const cursorSchema = z.number().int().safe().nonnegative();
export const watchSubagentsInputSchema = z.strictObject({
  parentAgentId: idSchema,
  piSessionId: idSchema.optional(),
  cursor: cursorSchema.optional(),
});

export const sequencedAgentStatusSchema = z.strictObject({
  cursor: cursorSchema,
  status: agentStatusSchema,
});

export const subagentSnapshotSchema = z.strictObject({
  agents: z.array(agentStatusSchema).max(MAX_AGENT_COUNT),
  lastHeartbeatAt: timestampSchema.nullable(),
});

export const watchSubagentsOutputSchema = z
  .strictObject({
    parentAgentId: idSchema,
    piSessionId: idSchema.nullable(),
    availability: monitoringAvailabilitySchema,
    cursor: cursorSchema,
    gap: z.boolean(),
    snapshot: subagentSnapshotSchema.nullable(),
    updates: z.array(sequencedAgentStatusSchema).max(MAX_WATCH_UPDATE_COUNT),
  })
  .superRefine((output, context) => {
    if (output.gap && output.snapshot === null) {
      context.addIssue({
        code: "custom",
        path: ["snapshot"],
        message: "A missed-update gap must include a current snapshot.",
      });
    }
    if (output.snapshot !== null && output.updates.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["updates"],
        message: "A watch response returns a snapshot or deltas, not both.",
      });
    }
    if (
      output.piSessionId === null &&
      (output.snapshot !== null || output.updates.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["piSessionId"],
        message: "Status data requires a Pi session identity.",
      });
    }

    const statuses = [
      ...(output.snapshot?.agents ?? []),
      ...output.updates.map(({ status }) => status),
    ];
    const keys = new Set();
    for (const [index, status] of statuses.entries()) {
      if (output.piSessionId !== status.piSessionId) {
        context.addIssue({
          code: "custom",
          path: [output.snapshot ? "snapshot" : "updates", index],
          message: "Status session identity must match the watch response.",
        });
      }
      const key =
        status.source === AGENT_SOURCE.WORKFLOW
          ? `${status.piSessionId}\u0000${status.source}\u0000${status.runId}\u0000${status.agentId}`
          : `${status.piSessionId}\u0000${status.source}\u0000${status.agentId}`;
      if (output.snapshot !== null && keys.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["snapshot", "agents", index],
          message: "A snapshot cannot contain duplicate agent identities.",
        });
      }
      keys.add(key);
    }

    let previousCursor = 0;
    for (const [index, update] of output.updates.entries()) {
      if (update.cursor <= previousCursor || update.cursor > output.cursor) {
        context.addIssue({
          code: "custom",
          path: ["updates", index, "cursor"],
          message:
            "Update cursors must increase and not exceed the response cursor.",
        });
      }
      previousCursor = update.cursor;
    }
  });
