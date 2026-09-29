import { defineAttachmentSource, defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

const itemSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  url: z.url(),
  text: z.string(),
  resourceType: z.string(),
});

export const searchDemoResources = defineRpc({
  name: "demo-resources.search",
  input: z.object({ query: z.string().max(100) }),
  output: z.object({ items: z.array(itemSchema).max(10) }),
});

export const demoResources = defineAttachmentSource({
  id: "paseo-docs",
  title: "Paseo documentation",
  icon: "BookOpen",
  pickerTitle: "Attach Paseo documentation",
  searchPlaceholder: "Search plugin topics",
  search: searchDemoResources,
});

// Explicit demo data: these are stable snapshots of public documentation topics.
export const DEMO_RESOURCES = [
  {
    id: "plugin-reference",
    identifier: "DOC-PLUGIN",
    title: "Paseo plugin reference",
    subtitle: "Runtime and contribution contracts",
    url: "https://paseo.sh/docs/plugins/reference",
    text: "Paseo plugins have separate client and server entries. Client code contributes UI and callbacks; server code handles daemon-side work. Shared modules contain JSON-safe contracts.",
    resourceType: "documentation",
  },
  {
    id: "plugin-quickstart",
    identifier: "DOC-QUICKSTART",
    title: "Paseo plugin quickstart",
    subtitle: "Create, typecheck, install, and reload",
    url: "https://paseo.sh/docs/plugins",
    text: "Create a plugin project, typecheck it locally, install it on the intended daemon, confirm it is running, and reload after source changes.",
    resourceType: "documentation",
  },
] as const;
