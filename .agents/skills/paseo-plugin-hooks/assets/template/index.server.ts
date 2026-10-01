import type { PluginServerContext } from "@getpaseo/plugin/server";
import { isRecursiveDeletion, requestsSingleFollowUp } from "./server/policy";

export default function contribute(server: PluginServerContext) {
  // ponytail: one follow-up per agent per plugin lifetime; persist counters for restart continuity.
  const followedAgents = new Set<string>();

  const removeSessionOpen = server.before(
    "agent.session_open",
    ({ request }) => {
      if (request.purpose === "history") {
        return request;
      }
      return {
        ...request,
        env: {
          ...request.env,
          PASEO_HOOKS_POLICY: "interactive",
        },
      };
    },
  );

  const removePermission = server.on(
    "agent.permission_requested",
    async (event, { paseo }) => {
      if (
        event.request.kind !== "tool" ||
        event.request.detail?.type !== "shell" ||
        !isRecursiveDeletion(event.request.detail.command)
      ) {
        return;
      }

      await paseo.agents.ref(event.agent.id).respondToPermission({
        requestId: event.request.id,
        response: {
          behavior: "deny",
          message: "Recursive deletion is blocked by the hooks template.",
        },
      });
    },
  );

  const removeTurnEnded = server.on(
    "agent.turn_ended",
    async (event, { paseo }) => {
      if (event.outcome.kind !== "completed") {
        return;
      }
      const lastAssistant = [...event.timeline]
        .reverse()
        .find((item) => item.type === "assistant_message");
      if (!lastAssistant || !requestsSingleFollowUp(lastAssistant.text)) {
        return;
      }

      if (followedAgents.has(event.agent.id)) {
        return;
      }
      followedAgents.add(event.agent.id);
      await paseo.agents
        .ref(event.agent.id)
        .send("Continue once. Do not emit [retry-once] in the next response.");
    },
  );

  return () => {
    removeTurnEnded();
    removePermission();
    removeSessionOpen();
    followedAgents.clear();
  };
}
