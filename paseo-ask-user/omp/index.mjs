import { brokerDialogResponseSchema } from "../shared/ask-schema.mjs";

/** @typedef {{ id: string, question: string, header?: string, options: { label: string, description?: string, preview?: string }[], multi?: boolean, recommended?: number }} NativeQuestion */
/** @typedef {{ kind: "answers", results: { id: string, selectedOptions: string[], customInput?: string, note?: string, timedOut?: boolean }[] } | { kind: "chat" } | undefined} NativeDialogResult */
/** @typedef {{ timeout?: number, signal?: RuntimeAbortSignal }} NativeDialogOptions */
/** @typedef {{ questions: NativeQuestion[] }} NativeAskParams */
/** @typedef {{ name: string, label?: string, description: string, parameters: (input: unknown) => unknown }} NativeAskTool */
/** @typedef {{ askDialog?: (questions: NativeQuestion[], options?: NativeDialogOptions) => Promise<NativeDialogResult> }} NativeAskUI */
/** @typedef {{ hasUI: boolean, ui: NativeAskUI, invokeTool: (params: unknown, options: { signal: RuntimeAbortSignal }) => Promise<unknown> }} NativeToolContext */
/** @typedef {{ name: string, label: string, description: string, parameters: NativeAskTool["parameters"], concurrency: "exclusive", execute: (id: string, params: NativeAskParams, signal: RuntimeAbortSignal | undefined, update: unknown, toolCtx: NativeToolContext) => Promise<unknown> }} NativeRegisteredTool */
/** @typedef {{ getAllTools: () => NativeAskTool[], registerTool: (tool: NativeRegisteredTool) => void, on: (event: string, listener: (...args: any[]) => void) => void }} NativeExtensionAPI */
/** @typedef {AbortSignal} RuntimeAbortSignal */

const URL_ENV = "PASEO_ASK_USER_BROKER_URL";
const TOKEN_ENV = "PASEO_ASK_USER_BROKER_TOKEN";
const SUPPORTED_ASK_TOOL = "ask";

/** @param {string} value */
function brokerEndpoint(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${URL_ENV} must be a valid loopback HTTP URL.`);
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "::1", "localhost"].includes(host) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${URL_ENV} must be a loopback HTTP URL without credentials, query, or fragment.`,
    );
  }
  url.pathname = `${url.pathname.replace(/\/+$/u, "")}/dialog`;
  return url.href;
}

function environment() {
  const url = process.env[URL_ENV];
  const token = process.env[TOKEN_ENV];
  if (url === undefined && token === undefined) return undefined;
  if (!url || !token || /[\u0000-\u001f\u007f]/u.test(token)) {
    throw new Error("Invalid Paseo ask-user broker session environment.");
  }
  return { endpoint: brokerEndpoint(url), token };
}

/** @param {unknown} value @returns {value is { questions: NativeQuestion[] }} */
function hasParsedQuestions(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    "questions" in value &&
    Array.isArray(value.questions) &&
    value.questions[0]?.id === "probe" &&
    Array.isArray(value.questions[0]?.options) &&
    value.questions[0]?.options[0]?.label === "Choice"
  );
}

/** @param {NativeAskTool | undefined} tool */
function checkNativeTool(tool) {
  if (
    !tool ||
    tool.name !== SUPPORTED_ASK_TOOL ||
    typeof tool.description !== "string" ||
    typeof tool.parameters !== "function"
  ) {
    throw new Error(
      "Unsupported OMP native ask tool API; Paseo ask-user companion was not registered.",
    );
  }

  let valid;
  let invalid;
  try {
    valid = tool.parameters({
      questions: [
        { id: "probe", question: "Probe", options: [{ label: "Choice" }] },
      ],
    });
    invalid = tool.parameters({ questions: "invalid" });
  } catch {
    throw new Error(
      "Unsupported OMP native ask schema; Paseo ask-user companion was not registered.",
    );
  }
  if (!hasParsedQuestions(valid) || hasParsedQuestions(invalid)) {
    throw new Error(
      "Unsupported OMP native ask schema; Paseo ask-user companion was not registered.",
    );
  }
  return tool;
}

/** @param {NativeQuestion[]} questions */
function normalizeQuestions(questions) {
  return questions.map((question) => {
    const recommended = question.recommended;
    return {
      id: question.id,
      prompt: question.question,
      ...(question.header === undefined ? {} : { label: question.header }),
      options: question.options.map((option, index) => ({
        value: String(index),
        label: option.label,
        ...(option.description === undefined
          ? {}
          : { description: option.description }),
        ...(option.preview === undefined ? {} : { preview: option.preview }),
      })),
      selectionMode: question.multi ? "multiple" : "single",
      ...(typeof recommended === "number" &&
      Number.isInteger(recommended) &&
      recommended >= 0 &&
      recommended < question.options.length
        ? { recommendationIndex: recommended }
        : {}),
    };
  });
}

/** @param {number | undefined} timeout */
function timeoutMs(timeout) {
  if (
    typeof timeout !== "number" ||
    !Number.isFinite(timeout) ||
    timeout <= 0
  ) {
    return undefined;
  }
  return Math.ceil(timeout);
}

/**
 * @param {RuntimeAbortSignal[]} sources
 * @returns {{ signal: AbortSignal, cleanup: () => void }}
 */
function composeSignals(sources) {
  const controller = new AbortController();
  const listeners = sources.map((source) => {
    const abort = () => controller.abort();
    if (source.aborted) abort();
    else source.addEventListener("abort", abort, { once: true });
    return { source, abort };
  });
  return {
    signal: controller.signal,
    cleanup() {
      for (const { source, abort } of listeners) {
        source.removeEventListener("abort", abort);
      }
    },
  };
}

/** @param {NativeQuestion[]} questions */
function timedOutResult(questions) {
  return {
    kind: "answers",
    results: questions.map((question) => {
      return {
        id: question.id,
        selectedOptions: [],
        timedOut: true,
      };
    }),
  };
}

/** @param {NativeQuestion[]} questions @param {{ questionId: string, kind: "selection" | "custom", values?: string[], text?: string, note?: string }[]} answers */
function submittedResult(questions, answers) {
  if (answers.length !== questions.length) {
    throw new Error(
      "Paseo ask-user broker returned a result count that does not match the requested questions.",
    );
  }
  const answersById = new Map(
    answers.map((answer) => [answer.questionId, answer]),
  );
  return {
    kind: "answers",
    results: questions.map((question) => {
      const answer = answersById.get(question.id);
      if (!answer)
        throw new Error(
          "Paseo ask-user broker returned a result for an unknown question.",
        );
      if (answer.kind === "custom") {
        return {
          id: question.id,
          selectedOptions: [],
          customInput: answer.text,
          ...(answer.note === undefined ? {} : { note: answer.note }),
        };
      }
      const indexes = (answer.values ?? []).map((value) => {
        if (!/^(0|[1-9]\d*)$/u.test(value)) {
          throw new Error(
            "Paseo ask-user broker returned an unknown option value.",
          );
        }
        const index = Number(value);
        if (!Number.isSafeInteger(index) || index >= question.options.length) {
          throw new Error(
            "Paseo ask-user broker returned an unknown option value.",
          );
        }
        return index;
      });
      if (new Set(indexes).size !== indexes.length) {
        throw new Error(
          "Paseo ask-user broker returned a duplicate option value.",
        );
      }
      indexes.sort((left, right) => left - right);
      return {
        id: question.id,
        selectedOptions: indexes.map((index) => question.options[index].label),
        ...(answer.note === undefined ? {} : { note: answer.note }),
      };
    }),
  };
}

function abortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

/** @param {{ endpoint: string, token: string }} config @param {RuntimeAbortSignal} shutdownSignal */
function createBrokerDialog(config, shutdownSignal) {
  /** @param {NativeQuestion[]} questions @param {NativeDialogOptions} [options] */
  return async (questions, options = {}) => {
    const composed = composeSignals(
      options.signal ? [options.signal, shutdownSignal] : [shutdownSignal],
    );
    const { signal } = composed;

    try {
      let response;
      try {
        response = await fetch(config.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            questions: normalizeQuestions(questions),
            timeoutMs: timeoutMs(options.timeout) ?? 0,
          }),
          redirect: "error",
          signal,
        });
      } catch (error) {
        if (
          signal.aborted ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          throw abortError();
        }
        throw error;
      }

      if (response.status === 499) return undefined;
      if (response.status === 504) return timedOutResult(questions);
      if (!response.ok) {
        throw new Error(
          `Paseo ask-user broker returned HTTP ${response.status}.`,
        );
      }
      let body;
      try {
        body = await response.json();
      } catch (error) {
        throw new Error("Paseo ask-user broker returned invalid JSON.", {
          cause: error,
        });
      }
      const parsed = brokerDialogResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new Error(
          "Paseo ask-user broker returned an invalid dialog response.",
          {
            cause: parsed.error,
          },
        );
      }
      if (parsed.data.action === "cancel") return undefined;
      if (parsed.data.action === "chat") return { kind: "chat" };
      if (parsed.data.action === "timeout") return timedOutResult(questions);
      if (parsed.data.action !== "submit") {
        throw new Error(
          "Paseo ask-user broker returned an unsupported dialog action.",
        );
      }
      return submittedResult(questions, parsed.data.answers);
    } finally {
      composed.cleanup();
    }
  };
}

/** @param {NativeExtensionAPI} pi */
export default function registerPaseoAskUserOmp(pi) {
  const config = environment();
  if (!config) return;
  if (
    typeof pi?.on !== "function" ||
    typeof pi.getAllTools !== "function" ||
    typeof pi.registerTool !== "function"
  ) {
    throw new Error(
      "Unsupported OMP extension API; Paseo ask-user companion was not registered.",
    );
  }

  let nativeTool;
  let registered = false;
  let shutdownController = new AbortController();

  const shutdown = () => {
    shutdownController.abort();
  };

  pi.on("session_start", () => {
    if (registered) {
      shutdownController.abort();
      shutdownController = new AbortController();
      return;
    }
    const matches = pi
      .getAllTools()
      .filter((tool) => tool.name === SUPPORTED_ASK_TOOL);
    if (matches.length !== 1) {
      throw new Error(
        "Unsupported OMP native ask tool set; Paseo ask-user companion was not registered.",
      );
    }
    nativeTool = checkNativeTool(matches[0]);
    pi.registerTool({
      name: nativeTool.name,
      label: nativeTool.label ?? "Ask",
      description: nativeTool.description,
      parameters: nativeTool.parameters,
      concurrency: "exclusive",
      execute: async (_toolCallId, params, signal, _onUpdate, toolCtx) => {
        if (toolCtx?.hasUI !== true || !toolCtx.ui) {
          throw new Error(
            "Paseo ask-user broker requires an interactive OMP session.",
          );
        }
        if (typeof toolCtx.invokeTool !== "function") {
          throw new Error(
            "Unsupported OMP ask delegation API; native ask cannot be invoked.",
          );
        }

        const composed = signal
          ? composeSignals([signal, shutdownController.signal])
          : undefined;
        const invokeSignal = composed?.signal ?? shutdownController.signal;
        const ui = toolCtx.ui;
        const originalDescriptor = Object.getOwnPropertyDescriptor(
          ui,
          "askDialog",
        );
        try {
          Object.defineProperty(ui, "askDialog", {
            configurable: true,
            enumerable: originalDescriptor?.enumerable ?? true,
            writable: true,
            value: createBrokerDialog(config, shutdownController.signal),
          });
          return await toolCtx.invokeTool(params, { signal: invokeSignal });
        } finally {
          if (originalDescriptor) {
            Object.defineProperty(ui, "askDialog", originalDescriptor);
          } else {
            delete ui.askDialog;
          }
          composed?.cleanup();
        }
      },
    });
    registered = true;
  });

  pi.on("session_shutdown", shutdown);
}
