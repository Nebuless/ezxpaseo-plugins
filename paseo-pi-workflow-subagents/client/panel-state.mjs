/**
 * @typedef {import("../shared/subagents.ts").SubagentStatus} SubagentStatus
 * @typedef {import("../shared/subagents.ts").WatchSubagentsOutput} WatchSubagentsOutput
 * @typedef {import("../shared/subagents.ts").AgentAvailability} AgentAvailability
 *
 * @typedef {object} PanelState
 * @property {Map<string, SubagentStatus>} agents
 * @property {string | null} piSessionId
 * @property {number | undefined} cursor
 * @property {AgentAvailability | null} availability
 * @property {boolean} gapDetected
 * @property {boolean} hasResponse
 */

/** @returns {PanelState} */
export function createPanelState() {
  return {
    agents: new Map(),
    piSessionId: null,
    cursor: undefined,
    availability: null,
    gapDetected: false,
    hasResponse: false,
  };
}

/**
 * Session identity is part of every key: upstream IDs can repeat across sources
 * and Pi sessions, and workflow IDs can repeat across runs.
 * @param {SubagentStatus} status
 * @returns {string}
 */
export function subagentStatusKey(status) {
  return JSON.stringify(
    status.source === "workflow"
      ? [status.piSessionId, status.source, status.runId, status.agentId]
      : [status.piSessionId, status.source, status.agentId],
  );
}

/** @param {string} state @returns {string} */
export function formatAgentState(state) {
  const words = state.split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Reconcile a snapshot or cursor delta without ever accepting another parent's
 * payload. Snapshots replace the current list; deltas replace one scoped status.
 * @param {PanelState} current
 * @param {WatchSubagentsOutput} response
 * @param {string} parentAgentId
 * @returns {PanelState}
 */
export function applyWatchResponse(current, response, parentAgentId) {
  if (response.parentAgentId !== parentAgentId) return current;

  const sessionChanged = current.piSessionId !== response.piSessionId;
  if (
    response.piSessionId !== null &&
    current.piSessionId === response.piSessionId &&
    current.cursor !== undefined &&
    response.cursor < current.cursor
  ) {
    return current;
  }

  const replaceAgents =
    response.snapshot !== null ||
    sessionChanged ||
    response.piSessionId === null;
  const agents = replaceAgents ? new Map() : new Map(current.agents);
  if (response.snapshot !== null) {
    for (const status of response.snapshot.agents) {
      if (response.piSessionId === status.piSessionId) {
        agents.set(subagentStatusKey(status), status);
      }
    }
  } else {
    for (const update of response.updates) {
      if (response.piSessionId === update.status.piSessionId) {
        agents.set(subagentStatusKey(update.status), update.status);
      }
    }
  }

  return {
    agents,
    piSessionId: response.piSessionId,
    cursor: response.cursor,
    availability: response.availability,
    gapDetected: response.gap || (!sessionChanged && current.gapDetected),
    hasResponse: true,
  };
}
