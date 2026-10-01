import type { PluginServerContext } from "@getpaseo/plugin/server";
import { runAcpProvider } from "@getpaseo/plugin/server/acp";
import { resolveGeminiCommand } from "./server/command";

export default function contribute(server: PluginServerContext) {
  const command = resolveGeminiCommand(process.env);
  server.registerProvider(
    runAcpProvider({
      id: "gemini-explicit",
      label: "Gemini CLI (explicit binary)",
      description: "Gemini CLI over its documented --acp stdio mode.",
      icon: "icon.svg",
      command,
    }),
  );
  return () => {};
}
