const TOOL_NAME = "local_echo";
const MAX_INPUT_BYTES = 64 * 1024;
const MAX_TEXT_LENGTH = 256;

export function createHelperSource(): string {
  return `(${runHelper.toString()})(${JSON.stringify({
    maxInputBytes: MAX_INPUT_BYTES,
    maxTextLength: MAX_TEXT_LENGTH,
    toolName: TOOL_NAME,
  })});`;
}

type RuntimeSettings = {
  readonly maxInputBytes: number;
  readonly maxTextLength: number;
  readonly toolName: string;
};

function runHelper(settings: RuntimeSettings): void {
  let buffer = "";

  function write(message: unknown): void {
    process.stdout.write(`${JSON.stringify(message)}\n`);
  }

  function result(id: unknown, value: unknown): void {
    write({ jsonrpc: "2.0", id, result: value });
  }

  function error(id: unknown, code: number, message: string): void {
    write({ jsonrpc: "2.0", id, error: { code, message } });
  }

  function handle(value: unknown): void {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      !("jsonrpc" in value) ||
      value.jsonrpc !== "2.0" ||
      !("method" in value) ||
      typeof value.method !== "string"
    ) {
      error(null, -32600, "Invalid JSON-RPC request.");
      return;
    }

    const id = "id" in value ? value.id : null;
    if (value.method === "notifications/initialized") {
      return;
    }
    if (value.method === "initialize") {
      result(id, {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "paseo-local-echo", version: "1.0.0" },
      });
      return;
    }
    if (value.method === "ping") {
      result(id, {});
      return;
    }
    if (value.method === "tools/list") {
      result(id, {
        tools: [
          {
            name: settings.toolName,
            description: "Return bounded local text in uppercase.",
            inputSchema: {
              type: "object",
              additionalProperties: false,
              required: ["text"],
              properties: {
                text: {
                  type: "string",
                  minLength: 1,
                  maxLength: settings.maxTextLength,
                },
              },
            },
          },
        ],
      });
      return;
    }
    if (value.method === "tools/call") {
      const params = "params" in value ? value.params : undefined;
      if (
        params !== null &&
        typeof params === "object" &&
        !Array.isArray(params) &&
        "name" in params &&
        params.name === settings.toolName &&
        "arguments" in params
      ) {
        const toolArguments = params.arguments;
        if (
          toolArguments !== null &&
          typeof toolArguments === "object" &&
          !Array.isArray(toolArguments) &&
          "text" in toolArguments &&
          typeof toolArguments.text === "string" &&
          toolArguments.text.length >= 1 &&
          toolArguments.text.length <= settings.maxTextLength
        ) {
          result(id, {
            content: [{ type: "text", text: toolArguments.text.toUpperCase() }],
          });
          return;
        }
      }
      result(id, {
        isError: true,
        content: [
          { type: "text", text: "Expected text with 1 to 256 characters." },
        ],
      });
      return;
    }
    error(id, -32601, `Method not found: ${value.method}`);
  }

  function drain(): void {
    for (;;) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) {
        return;
      }
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      if (line.length === 0) {
        continue;
      }
      try {
        handle(JSON.parse(line));
      } catch (parseError) {
        error(
          null,
          -32700,
          parseError instanceof Error ? parseError.message : "Invalid JSON.",
        );
      }
    }
  }

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    buffer += chunk;
    if (Buffer.byteLength(buffer, "utf8") > settings.maxInputBytes) {
      buffer = "";
      error(null, -32600, "MCP input is too large.");
      return;
    }
    drain();
  });
}
