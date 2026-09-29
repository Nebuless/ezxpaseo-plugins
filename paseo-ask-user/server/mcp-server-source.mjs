import * as z from "zod";
import {
  ASK_BROKER_TOKEN_ENV,
  ASK_BROKER_URL_ENV,
  ASK_TOOL_NAME,
  askToolInputSchema,
} from "../shared/ask-schema.mjs";

export function createMcpServerSource() {
  const runtimeSettings = {
    brokerTokenEnvironment: ASK_BROKER_TOKEN_ENV,
    brokerUrlEnvironment: ASK_BROKER_URL_ENV,
    inputSchema: z.toJSONSchema(askToolInputSchema),
    toolName: ASK_TOOL_NAME,
  };
  const serverSource = `(${runMcpServer.toString()})(${JSON.stringify(runtimeSettings)});`;
  const encodedServerSource = Buffer.from(serverSource, "utf8").toString(
    "base64",
  );
  return `eval(Buffer.from(${JSON.stringify(encodedServerSource)}, "base64").toString("utf8"));`;
}

/**
 * @typedef {object} McpRuntimeSettings
 * @property {string} brokerTokenEnvironment
 * @property {string} brokerUrlEnvironment
 * @property {Record<string, unknown>} inputSchema
 * @property {string} toolName
 */

/**
 * @typedef {object} JsonRpcMessage
 * @property {unknown} [jsonrpc]
 * @property {unknown} [id]
 * @property {unknown} [method]
 * @property {{
 *   protocolVersion?: unknown,
 *   requestId?: unknown,
 *   name?: unknown,
 *   arguments?: unknown
 * }} [params]
 */

/** @param {McpRuntimeSettings} runtimeSettings */
function runMcpServer(runtimeSettings) {
  const JSON_RPC_VERSION = "2.0";
  const SERVER_NAME = "paseo-ask-user";
  const SERVER_VERSION = "0.1.0";
  const MAX_BUFFER_BYTES = 10 * 1024 * 1024;
  const METHOD = {
    INITIALIZE: "initialize",
    INITIALIZED: "notifications/initialized",
    CANCELLED: "notifications/cancelled",
    PING: "ping",
    TOOLS_LIST: "tools/list",
    TOOLS_CALL: "tools/call",
  };
  const ERROR_CODE = {
    PARSE: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL: -32603,
  };
  const TOOL_DESCRIPTION =
    "Ask the human one to four structured questions in Paseo and wait for their answers.";
  const brokerUrl = process.env[runtimeSettings.brokerUrlEnvironment];
  const brokerToken = process.env[runtimeSettings.brokerTokenEnvironment];
  if (!brokerUrl || !brokerToken) {
    throw new Error(
      `Missing ${runtimeSettings.brokerUrlEnvironment} or ${runtimeSettings.brokerTokenEnvironment}.`,
    );
  }

  /** @type {Map<string, AbortController>} */
  const pendingCalls = new Map();
  let inputBuffer = "";

  /** @param {unknown} message */
  function send(message) {
    process.stdout.write(`${JSON.stringify(message)}\n`);
  }

  /**
   * @param {unknown} id
   * @param {unknown} result
   */
  function sendResult(id, result) {
    send({ jsonrpc: JSON_RPC_VERSION, id, result });
  }

  /**
   * @param {unknown} id
   * @param {number} code
   * @param {string} message
   */
  function sendError(id, code, message) {
    send({ jsonrpc: JSON_RPC_VERSION, id, error: { code, message } });
  }

  /** @param {unknown} error */
  function describeError(error) {
    return error instanceof Error ? error.message : String(error);
  }

  /** @param {unknown} requestId */
  function requestKey(requestId) {
    return JSON.stringify(requestId);
  }

  /**
   * @param {unknown} requestId
   * @param {unknown} toolArguments
   */
  async function callAskTool(requestId, toolArguments) {
    const abortController = new AbortController();
    const key = requestKey(requestId);
    pendingCalls.set(key, abortController);
    try {
      const response = await fetch(`${brokerUrl}/ask`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${brokerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(toolArguments),
        signal: abortController.signal,
      });
      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(
          `Paseo ask broker returned ${response.status}: ${responseText}`,
        );
      }
      const answer = JSON.parse(responseText);
      sendResult(requestId, {
        content: [{ type: "text", text: JSON.stringify(answer) }],
      });
    } catch (error) {
      sendResult(requestId, {
        isError: true,
        content: [{ type: "text", text: describeError(error) }],
      });
    } finally {
      pendingCalls.delete(key);
    }
  }

  /** @param {unknown} requestId */
  function cancelCall(requestId) {
    pendingCalls.get(requestKey(requestId))?.abort();
  }

  /** @param {JsonRpcMessage} message */
  async function handleMessage(message) {
    if (
      message === null ||
      typeof message !== "object" ||
      Array.isArray(message) ||
      message.jsonrpc !== JSON_RPC_VERSION ||
      typeof message.method !== "string"
    ) {
      sendError(null, ERROR_CODE.INVALID_REQUEST, "Invalid JSON-RPC request.");
      return;
    }

    const hasRequestId = Object.prototype.hasOwnProperty.call(message, "id");
    if (message.method === METHOD.INITIALIZED) {
      return;
    }
    if (message.method === METHOD.CANCELLED) {
      cancelCall(message.params?.requestId);
      return;
    }
    if (!hasRequestId) {
      return;
    }
    if (message.method === METHOD.INITIALIZE) {
      sendResult(message.id, {
        protocolVersion: message.params?.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });
      return;
    }
    if (message.method === METHOD.PING) {
      sendResult(message.id, {});
      return;
    }
    if (message.method === METHOD.TOOLS_LIST) {
      sendResult(message.id, {
        tools: [
          {
            name: runtimeSettings.toolName,
            description: TOOL_DESCRIPTION,
            inputSchema: runtimeSettings.inputSchema,
          },
        ],
      });
      return;
    }
    if (message.method === METHOD.TOOLS_CALL) {
      if (message.params?.name !== runtimeSettings.toolName) {
        sendError(
          message.id,
          ERROR_CODE.INVALID_PARAMS,
          `Unknown tool: ${String(message.params?.name)}`,
        );
        return;
      }
      await callAskTool(message.id, message.params.arguments ?? {});
      return;
    }
    sendError(
      message.id,
      ERROR_CODE.METHOD_NOT_FOUND,
      `Method not found: ${message.method}`,
    );
  }

  function processInput() {
    for (;;) {
      const newlineIndex = inputBuffer.indexOf("\n");
      if (newlineIndex === -1) {
        return;
      }
      const line = inputBuffer.slice(0, newlineIndex).replace(/\r$/, "");
      inputBuffer = inputBuffer.slice(newlineIndex + 1);
      if (line.length === 0) {
        continue;
      }
      /** @type {JsonRpcMessage} */
      let message;
      try {
        message = JSON.parse(line);
      } catch (error) {
        sendError(null, ERROR_CODE.PARSE, describeError(error));
        continue;
      }
      void handleMessage(message).catch((error) => {
        const requestId =
          message !== null &&
          typeof message === "object" &&
          Object.prototype.hasOwnProperty.call(message, "id")
            ? message.id
            : null;
        sendError(requestId, ERROR_CODE.INTERNAL, describeError(error));
      });
    }
  }

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    inputBuffer += chunk;
    if (Buffer.byteLength(inputBuffer, "utf8") > MAX_BUFFER_BYTES) {
      inputBuffer = "";
      sendError(null, ERROR_CODE.INVALID_REQUEST, "MCP input is too large.");
      return;
    }
    processInput();
  });
  process.stdin.on("end", () => {
    for (const abortController of pendingCalls.values()) {
      abortController.abort();
    }
  });
}
