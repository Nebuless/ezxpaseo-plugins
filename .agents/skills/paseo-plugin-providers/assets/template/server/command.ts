import { accessSync, constants, statSync } from "node:fs";
import { isAbsolute } from "node:path";

export class GeminiBinaryConfigurationError extends Error {
  readonly name = "GeminiBinaryConfigurationError";
}

export function resolveGeminiCommand(
  environment: Readonly<Record<string, string | undefined>>,
): readonly [string, "--acp"] {
  const binary = environment["PASEO_GEMINI_BIN"];
  if (!binary) {
    throw new GeminiBinaryConfigurationError(
      "Set PASEO_GEMINI_BIN to the absolute path of the installed Gemini CLI executable.",
    );
  }
  if (!isAbsolute(binary)) {
    throw new GeminiBinaryConfigurationError(
      "PASEO_GEMINI_BIN must be an absolute path.",
    );
  }
  try {
    accessSync(binary, constants.X_OK);
    if (!statSync(binary).isFile()) {
      throw new GeminiBinaryConfigurationError(
        "PASEO_GEMINI_BIN must point to a regular file.",
      );
    }
  } catch (error) {
    if (error instanceof GeminiBinaryConfigurationError) {
      throw error;
    }
    throw new GeminiBinaryConfigurationError(
      `PASEO_GEMINI_BIN is not executable: ${binary}`,
      { cause: error },
    );
  }
  return [binary, "--acp"];
}
