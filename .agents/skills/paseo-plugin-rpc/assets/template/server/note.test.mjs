import assert from "node:assert/strict";
import test from "node:test";
import { publishNote } from "./note.ts";
import { publishNoteRpc } from "../shared/note.ts";

test("publishes one validated timeline note", async () => {
  const appended = [];
  const context = {
    paseo: {
      agents: {
        ref() {
          return {
            timeline: {
              async append(item) {
                appended.push(item);
              },
            },
          };
        },
      },
    },
  };
  const input = publishNoteRpc.input.parse({
    agentId: "agent-1",
    noteId: "ready",
    label: "Ready for review",
  });

  const result = await publishNote(input, context);

  assert.deepEqual(result, { itemId: "note-ready" });
  assert.equal(appended.length, 1);
  assert.deepEqual(appended[0].data, { label: "Ready for review" });
});

test("rejects an over-limit note before the handler runs", () => {
  const result = publishNoteRpc.input.safeParse({
    agentId: "agent-1",
    noteId: "ready",
    label: "x".repeat(121),
  });

  assert.equal(result.success, false);
});
