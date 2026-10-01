import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalWindow } from "./local-window.ts";

test("builds utilization from recorded local activity", () => {
  assert.deepEqual(
    buildLocalWindow({
      start: "2026-09-29T00:00:00.000Z",
      end: "2026-09-30T00:00:00.000Z",
      usedActions: 25,
      actionLimit: 100,
    }),
    {
      utilizationPct: 25,
      resetsAt: "2026-09-30T00:00:00.000Z",
      detail: "25 of 100 local actions since 2026-09-29T00:00:00.000Z",
    },
  );
});
