import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brokerAskResponseSchema } from "../shared/ask-schema.mjs";

interface ExtensionAPI {
  getAllTools(): { name: string; sourceInfo?: { path?: string } }[];
  on(event: "session_shutdown", handler: () => void): void;
  on(
    event: "tool_result",
    handler: (
      event: {
        toolName: string;
        input: unknown;
        content: { type: string; text?: string }[];
      },
      context: {
        signal?: AbortSignal;
        ui: { notify(message: string, level: "error"): void };
      },
    ) => Promise<unknown>,
  ): void;
}

interface Question {
  id: string;
  label: string;
  prompt: string;
  options: { value: string; label: string; description?: string }[];
  selectionMode: "single" | "multiple";
  recommendedIndices: number[];
}
interface Answer {
  id: string;
  value: string;
  label: string;
  wasCustom: boolean;
  outOfScope: boolean;
  index?: number;
  selections?: { value: string; label: string; index: number }[];
}
interface NativeResult {
  questions: Question[];
  answers: Answer[];
  cancelled: boolean;
}
interface Sideroom {
  executeAsk(
    input: unknown,
    context: {
      mode: "tui";
      ui: { custom(): Promise<NativeResult> };
    },
  ): Promise<{
    content: { type: "text"; text: string }[];
    details: NativeResult;
  }>;
  parseAskParams(
    input: unknown,
  ): { ok: true; questions: Question[] } | { ok: false; message: string };
  OUT_OF_SCOPE_VALUE: string;
  OUT_OF_SCOPE_LABEL: string;
  UI_UNAVAILABLE: string;
}

export default function contribute(pi: ExtensionAPI) {
  const url = process.env.PASEO_ASK_USER_BROKER_URL;
  const token = process.env.PASEO_ASK_USER_BROKER_TOKEN;
  if (!url && !token) return;
  let endpoint: URL;
  let configurationError: Error | undefined;
  try {
    if (!url || !token || /[\u0000-\u001f\u007f]/u.test(token))
      throw new Error("Missing or invalid Paseo ask broker credentials");
    endpoint = new URL(url);
    if (
      endpoint.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    ) {
      throw new Error(
        "Paseo ask broker must be an authenticated loopback HTTP endpoint",
      );
    }
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/u, "")}/ask`;
  } catch (error) {
    configurationError =
      error instanceof Error ? error : new Error(String(error));
  }
  const shutdown = new AbortController();
  pi.on("session_shutdown", () => shutdown.abort());
  let loaded: Promise<Sideroom> | undefined;
  const load = async (): Promise<Sideroom> => {
    const tool = pi.getAllTools().find(({ name }) => name === "sideroom_ask");
    const source = tool?.sourceInfo?.path;
    if (!source)
      throw new Error("Paseo ask requires loaded Sideroom 8.11.0 sideroom_ask");
    let directory = dirname(source);
    for (;;) {
      try {
        const manifest = JSON.parse(
          await readFile(join(directory, "package.json"), "utf8"),
        );
        if (manifest.name === "@rmrdeveloper/sideroom-pi") {
          if (manifest.version !== "8.11.0")
            throw new Error(
              `Unsupported Sideroom version: ${manifest.version}; expected 8.11.0`,
            );
          break;
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Unsupported Sideroom")
        )
          throw error;
      }
      const parent = dirname(directory);
      if (parent === directory)
        throw new Error("Cannot identify loaded Sideroom package");
      directory = parent;
    }
    const sdk = fileURLToPath(
      import.meta.resolve("@earendil-works/pi-coding-agent"),
    );
    const sdkRequire = createRequire(sdk);
    // Resolve Jiti from the active Pi installation, not the companion's dependencies.
    const { createJiti } = await import(
      pathToFileURL(sdkRequire.resolve("jiti")).href
    );
    const jiti = createJiti(pathToFileURL(sdk).href, {
      interopDefault: true,
      alias: {
        "@earendil-works/pi-tui": sdkRequire.resolve("@earendil-works/pi-tui"),
        typebox: sdkRequire.resolve("typebox"),
        "typebox/value": sdkRequire.resolve("typebox/value"),
      },
    });
    const execute = await jiti.import(join(dirname(source), "execute.ts"), {
      default: false,
    });
    const model = await jiti.import(join(dirname(source), "model.ts"), {
      default: false,
    });
    const native = { ...model, ...execute } as Sideroom;
    if (
      typeof native.executeAsk !== "function" ||
      typeof native.parseAskParams !== "function" ||
      typeof native.UI_UNAVAILABLE !== "string"
    ) {
      throw new Error("Unsupported Sideroom ask runtime");
    }
    return native;
  };
  pi.on("tool_result", async (event, context) => {
    if (event.toolName !== "sideroom_ask") return;
    const controller = new AbortController();
    const abort = () => controller.abort();
    const signals = [context.signal, shutdown.signal].filter(
      (signal): signal is AbortSignal => signal !== undefined,
    );
    for (const signal of signals) {
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }
    try {
      if (configurationError) throw configurationError;
      const native = await (loaded ??= load());
      if (
        !event.content.some(
          (part) => part.type === "text" && part.text === native.UI_UNAVAILABLE,
        )
      )
        return;
      const parsed = native.parseAskParams(event.input);
      if (!parsed.ok) return;
      const questions = parsed.questions;
      const signal = controller.signal;
      const result = await native.executeAsk(event.input, {
        mode: "tui",
        ui: {
          custom: async () => {
            const canceled = (): NativeResult => ({
              questions,
              answers: [],
              cancelled: true,
            });
            let response: Response;
            try {
              response = await fetch(endpoint!, {
                method: "POST",
                headers: {
                  authorization: `Bearer ${token}`,
                  "content-type": "application/json",
                },
                body: JSON.stringify({
                  questions: questions.map((question) => ({
                    id: question.id,
                    label: question.label,
                    prompt: question.prompt,
                    options: question.options,
                    selectionMode: question.selectionMode,
                    ...(question.selectionMode === "multiple"
                      ? { recommendedIndices: question.recommendedIndices }
                      : {
                          recommendationIndex: question.recommendedIndices[0],
                        }),
                  })),
                }),
                signal,
                redirect: "error",
              });
            } catch (error) {
              if (signal.aborted) return canceled();
              throw error;
            }
            if (response.status === 499 || response.status === 504)
              return canceled();
            if (!response.ok)
              throw new Error(
                `Paseo ask broker returned HTTP ${response.status}`,
              );
            const wire = brokerAskResponseSchema.parse(await response.json());
            if (wire.answers.length !== questions.length)
              throw new Error("Paseo ask answer count mismatch");
            const answers = questions.map((question): Answer => {
              const matches = wire.answers.filter(
                (answer) => answer.questionId === question.id,
              );
              if (matches.length !== 1)
                throw new Error("Paseo ask answer identity mismatch");
              const answer = matches[0];
              if (answer.kind === "out_of_scope")
                return {
                  id: question.id,
                  value: native.OUT_OF_SCOPE_VALUE,
                  label: native.OUT_OF_SCOPE_LABEL,
                  wasCustom: false,
                  outOfScope: true,
                };
              if (answer.kind === "custom" && "text" in answer)
                return {
                  id: question.id,
                  value: answer.text,
                  label: answer.text,
                  wasCustom: true,
                  outOfScope: false,
                };
              if (!("values" in answer))
                throw new Error("Unsupported Paseo ask answer");
              const indices = answer.values
                .map((value) =>
                  question.options.findIndex(
                    (option) => option.value === value,
                  ),
                )
                .sort((a, b) => a - b);
              if (
                indices.some((index) => index < 0) ||
                new Set(indices).size !== indices.length ||
                indices.length === 0 ||
                (question.selectionMode === "single" && indices.length !== 1)
              )
                throw new Error("Invalid Paseo ask selection");
              const selections = indices.map((index) => ({
                ...question.options[index],
                index: index + 1,
              }));
              return {
                id: question.id,
                value: selections[0].value,
                label: selections[0].label,
                index: selections[0].index,
                wasCustom: false,
                outOfScope: false,
                ...(question.selectionMode === "multiple" && { selections }),
              };
            });
            return { questions, answers, cancelled: false };
          },
        },
      });
      return {
        content: result.content,
        details: result.details,
        isError: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.ui.notify(`Paseo ask: ${message}`, "error");
      return {
        content: [{ type: "text", text: `Paseo ask: ${message}` }],
        details: { error: message },
        isError: true,
      };
    } finally {
      for (const signal of signals) signal.removeEventListener("abort", abort);
    }
  });
}
