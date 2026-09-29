import assert from "node:assert/strict";
import test from "node:test";
import { isRecursiveDeletion, requestsSingleFollowUp } from "./policy.ts";

test("matches only the explicit recursive deletion policy", () => {
  assert.equal(isRecursiveDeletion("rm -rf build"), true);
  assert.equal(isRecursiveDeletion("rm build"), false);
});

test("requires the bounded follow-up marker", () => {
  assert.equal(
    requestsSingleFollowUp("Please [retry-once] after this turn."),
    true,
  );
  assert.equal(requestsSingleFollowUp("Try again forever."), false);
});
