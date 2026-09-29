import assert from "node:assert/strict";
import test from "node:test";
import {
  GeminiBinaryConfigurationError,
  resolveGeminiCommand,
} from "./command.ts";

test("uses an executable absolute path with the documented ACP argument", () => {
  assert.deepEqual(resolveGeminiCommand({ PASEO_GEMINI_BIN: process.execPath }), [
    process.execPath,
    "--acp",
  ]);
});

test("fails clearly when binary configuration is absent", () => {
  assert.throws(
    () => resolveGeminiCommand({}),
    GeminiBinaryConfigurationError,
  );
});
