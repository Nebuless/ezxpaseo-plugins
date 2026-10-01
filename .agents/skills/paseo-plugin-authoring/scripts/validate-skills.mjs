import {
  readFileSync,
  readdirSync,
  existsSync,
  statSync,
  realpathSync,
} from "node:fs";
import { resolve, dirname, basename, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

export function validateSkills(input) {
  const root = realpathSync(input);
  const files = [];
  const errors = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git"].includes(entry.name)) continue;
      const path = resolve(dir, entry.name);
      if (entry.isSymbolicLink()) {
        errors.push(`${path}: symlink resources are not audited`);
      } else if (entry.isDirectory()) walk(path);
      else if (entry.name === "SKILL.md") files.push(path);
    }
  }
  walk(root);
  if (!files.length) errors.push(`${root}: no SKILL.md found`);
  const allowed = new Set([
    "name",
    "description",
    "license",
    "compatibility",
    "metadata",
    "allowed-tools",
  ]);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
    if (!front) {
      errors.push(`${file}: missing YAML frontmatter`);
      continue;
    }
    const doc = YAML.parseDocument(front[1], { uniqueKeys: true });
    if (doc.errors.length) {
      errors.push(
        `${file}: YAML ${doc.errors.map((e) => e.message).join(", ")}`,
      );
      continue;
    }
    const value = doc.toJS();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${file}: frontmatter must be a map`);
      continue;
    }
    for (const key of Object.keys(value))
      if (!allowed.has(key))
        errors.push(`${file}: unknown frontmatter field ${key}`);
    if (
      typeof value.name !== "string" ||
      value.name.length > 64 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.name)
    )
      errors.push(`${file}: invalid name`);
    if (value.name !== basename(dirname(file)))
      errors.push(`${file}: name must match parent directory`);
    for (const [key, max, required] of [
      ["description", 1024, true],
      ["compatibility", 500, false],
    ]) {
      if (required || value[key] !== undefined)
        if (
          typeof value[key] !== "string" ||
          !value[key].trim() ||
          value[key].length > max
        )
          errors.push(
            `${file}: ${key} must be nonempty text, at most ${max} characters`,
          );
    }
    for (const key of ["license", "allowed-tools"])
      if (
        value[key] !== undefined &&
        (typeof value[key] !== "string" || !value[key].trim())
      )
        errors.push(`${file}: ${key} must be nonempty text`);
    if (
      value.metadata !== undefined &&
      (!value.metadata ||
        typeof value.metadata !== "object" ||
        Array.isArray(value.metadata) ||
        Object.values(value.metadata).some((v) => typeof v !== "string"))
    )
      errors.push(`${file}: metadata must map strings to strings`);
    if (!text.slice(front[0].length).trim())
      errors.push(`${file}: missing instructions`);
    if (text.split("\n").length > 500)
      errors.push(`${file}: exceeds recommended 500-line instruction budget`);
    function checkLinks(path) {
      const markdown = readFileSync(path, "utf8").replace(
        /```[\s\S]*?```/g,
        "",
      );
      for (const match of markdown.matchAll(
        /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
      )) {
        const link = match[1].replace(/^<|>$/g, "");
        if (/^(?:[a-z]+:|#)/i.test(link)) continue;
        const target = resolve(
          dirname(path),
          decodeURIComponent(link.split("#")[0]),
        );
        if (!existsSync(target)) errors.push(`${path}: missing link ${link}`);
        else {
          const rel = relative(root, realpathSync(target));
          // A standalone skill may link siblings from this deliberately whole-suite distribution.
          if (
            (rel.startsWith("..") || isAbsolute(rel)) &&
            root !== dirname(file)
          )
            errors.push(`${path}: link escapes suite ${link}`);
        }
      }
    }
    checkLinks(file);
    const refs = resolve(dirname(file), "references");
    if (existsSync(refs))
      for (const entry of readdirSync(refs)) {
        const path = resolve(refs, entry);
        if (entry.endsWith(".md") && statSync(path).isFile()) checkLinks(path);
      }
  }
  return { count: files.length, errors };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 3)
      throw new Error(
        "Usage: node validate-skills.mjs <skills-or-skill-directory>",
      );
    const result = validateSkills(process.argv[2]);
    for (const error of result.errors) console.error(error);
    console.log(`${result.count} skill(s), ${result.errors.length} error(s)`);
    process.exitCode = result.errors.length ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
