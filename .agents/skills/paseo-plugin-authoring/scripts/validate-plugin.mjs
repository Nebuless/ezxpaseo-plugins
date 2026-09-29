import { readFileSync, readdirSync, existsSync, realpathSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import semver from "semver";
import ts from "typescript";

const clientModules = new Set(["@getpaseo/plugin", "@getpaseo/plugin/client", "@getpaseo/plugin/client/ui", "@getpaseo/plugin/client/react-native", "@tanstack/react-query", "react", "react/jsx-runtime", "react-native", "zod"]);
const runtimeModules = new Set(["react", "react-native", "@tanstack/react-query"]);
const nodes = new Set(builtinModules.map((name) => name.replace(/^node:/, "")));
const code = /\.(?:[cm]?[jt]sx?)$/;

export function validatePlugin(input, options = {}) {
  const root = realpathSync(input);
  const errors = [];
  const warnings = [];
  const fail = (path, message) => errors.push(`${relative(root, path) || "."}: ${message}`);
  function json(name) {
    const path = resolve(root, name);
    try { return JSON.parse(readFileSync(path, "utf8")); }
    catch (error) { fail(path, error instanceof Error ? error.message : String(error)); return null; }
  }
  const manifest = json("paseo-plugin.json");
  const pkg = json("package.json");
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", "dist", "coverage"].includes(entry.name)) continue;
      const path = resolve(dir, entry.name);
      if (entry.isSymbolicLink()) { fail(path, "symlink resource is not audited; use files inside plugin directory"); continue; }
      if (entry.isDirectory()) walk(path);
      else files.push(path);
    }
  }
  walk(root);
  const entries = {};
  for (const runtime of ["client", "server"]) {
    entries[runtime] = ["ts", "tsx"].map((ext) => resolve(root, `index.${runtime}.${ext}`)).filter(existsSync);
    if (entries[runtime].length > 1) fail(root, `duplicate ${runtime} entries`);
  }
  if (!entries.client.length && !entries.server.length) fail(root, "at least one runtime entry required; old index.ts must be migrated");
  const manifestPath = resolve(root, "paseo-plugin.json");
  let range;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail(manifestPath, "manifest must be object");
  else {
    if (typeof manifest.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(manifest.id)) fail(manifestPath, "invalid id; expected lowercase letter then lowercase letters, digits or hyphens");
    if (manifest.description !== undefined && (typeof manifest.description !== "string" || !manifest.description.trim())) fail(manifestPath, "description must be nonempty string");
    if (!manifest.requirements || typeof manifest.requirements !== "object" || Array.isArray(manifest.requirements)) fail(manifestPath, "requirements.paseo required for current authoring (omitted means <0.8.0)");
    else {
      for (const key of Object.keys(manifest.requirements)) if (key !== "paseo") fail(manifestPath, `unknown requirement ${key}`);
      range = manifest.requirements.paseo;
      if (typeof range !== "string" || !range.trim() || !semver.validRange(range)) { fail(manifestPath, "requirements.paseo must be nonempty valid npm semver range"); range = undefined; }
    }
    if (manifest.build !== undefined && (!Array.isArray(manifest.build) || manifest.build.some((argv) => !Array.isArray(argv) || !argv.length || argv.some((arg) => typeof arg !== "string") || !argv[0].trim()))) fail(manifestPath, "build must be list of nonempty argv arrays with string arguments");
    if (manifest.build?.length) warnings.push("Preparation executes unsandboxed on daemon; inspect argv and daemon PATH manually.");
  }
  for (const runtime of ["daemon", "client"]) {
    const version = options[`${runtime}Version`];
    if (version === undefined) continue;
    const parsed = semver.parse(version);
    if (!parsed) fail(root, `invalid ${runtime} version ${version}`);
    else if (range && (runtime !== "client" || entries.client.length) && !semver.satisfies(`${parsed.major}.${parsed.minor}.${parsed.patch}`, range)) fail(root, `${runtime} ${version} is not compatible with ${range}`);
  }
  const configPath = resolve(root, "tsconfig.json");
  let config;
  if (!existsSync(configPath)) fail(configPath, "missing TypeScript config");
  else {
    const read = ts.readConfigFile(configPath, ts.sys.readFile);
    if (read.error) fail(configPath, ts.flattenDiagnosticMessageText(read.error.messageText, "\n"));
    else {
      config = ts.parseJsonConfigFileContent(read.config, ts.sys, root);
      for (const error of config.errors) if (error.code !== 18003) fail(configPath, ts.flattenDiagnosticMessageText(error.messageText, "\n"));
      if (config.options.lib?.some((name) => /(?:^|\.)dom(?:\.|$)/i.test(name))) fail(configPath, "DOM lib is not portable to native clients");
      if (!config.options.strict) warnings.push("Enable strict TypeScript checking.");
    }
  }
  const covered = (name) => pkg?.files?.some((item) => typeof item === "string" && (item.replace(/\/$/, "") === name || name.startsWith(`${item.replace(/\/$/, "")}/`)));
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) fail(resolve(root, "package.json"), "package must be object");
  else if (!Array.isArray(pkg.files)) warnings.push("No explicit package files list; inspect npm dry-run before distribution.");
  else for (const file of [manifestPath, ...entries.client, ...entries.server]) if (!covered(relative(root, file))) fail(file, "required file omitted from package files list");

  function owner(path) {
    const rel = relative(root, path).replaceAll("\\", "/");
    if (/^index\.(client|server)\.tsx?$/.test(rel)) return rel.split(".")[1];
    if (/^(client|server|shared)\//.test(rel)) return rel.split("/")[0];
    return "root";
  }
  for (const file of files.filter((path) => code.test(path) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path))) {
    const runtime = owner(file);
    if (runtime === "root") { fail(file, "code module at plugin root or outside client/server/shared"); continue; }
    const text = readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    for (const diag of ast.parseDiagnostics) fail(file, ts.flattenDiagnosticMessageText(diag.messageText, "\n"));
    if (entries[runtime]?.includes(file) && !ast.statements.some((node) => (ts.isFunctionDeclaration(node) && node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.DefaultKeyword)) || (ts.isExportAssignment(node) && !node.isExportEquals))) fail(file, "runtime entry requires default contribution export");
    if (runtime !== "server" && /<reference\s+lib=["']dom(?:\.[^"']+)?["']/i.test(text)) fail(file, "DOM triple-slash reference is not portable");
    function checkImport(specifier) {
      if (specifier.startsWith("node:") || nodes.has(specifier)) {
        if (runtime !== "server") fail(file, `Node module ${specifier} forbidden in ${runtime}`);
        return;
      }
      const resolved = ts.resolveModuleName(specifier, file, config?.options ?? { moduleResolution: ts.ModuleResolutionKind.Bundler }, ts.sys).resolvedModule?.resolvedFileName;
      const local = resolved && !resolved.replaceAll("\\", "/").includes("/node_modules/");
      if (local) {
        const target = realpathSync(resolved);
        if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(target)) fail(file, `runtime import ${specifier} targets test code`);
        const rel = relative(root, target);
        if (rel.startsWith("..") || isAbsolute(rel)) { fail(file, `import ${specifier} escapes plugin directory`); return; }
        const dest = owner(target);
        if (dest === "root" || (runtime === "client" && dest === "server") || (runtime === "server" && dest === "client") || (runtime === "shared" && dest !== "shared")) fail(file, `${runtime} import ${specifier} crosses ${dest} boundary`);
        return;
      }
      if (specifier.startsWith(".")) { fail(file, `unresolved relative import ${specifier}`); return; }
      if (specifier === "@getpaseo/plugin/client/host") fail(file, "private host module forbidden");
      else if (runtime === "client" && !clientModules.has(specifier)) fail(file, `host module ${specifier} unavailable in client code`);
      else if (runtime === "server" && (runtimeModules.has(specifier) || specifier.startsWith("@tanstack/react-query/") || specifier.startsWith("@getpaseo/plugin/client") || specifier.startsWith("react/") || specifier.startsWith("react-native/"))) fail(file, `client module ${specifier} forbidden in server`);
      else if (runtime === "shared" && (runtimeModules.has(specifier) || specifier.startsWith("react/") || specifier.startsWith("react-native/") || /^@getpaseo\/plugin\/(client|server)/.test(specifier))) fail(file, `shared import ${specifier} is runtime-specific`);
      else if (runtime === "shared" && !["@getpaseo/plugin", "zod"].includes(specifier)) warnings.push(`${relative(root, file)}: manually audit shared dependency ${specifier} and transitive runtime imports.`);
    }
    function visit(node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) checkImport(node.moduleSpecifier.text);
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) checkImport(node.argument.literal.text);
      else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteralLike(arg)) checkImport(arg.text);
        else fail(file, "non-literal import/require cannot be statically audited");
      }
      if (runtime === "client" || runtime === "shared") {
        if (ts.isIdentifier(node) && ["window", "document", "localStorage", "navigator", "location"].includes(node.text) && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) && !(ts.isPropertyAssignment(node.parent) && node.parent.name === node)) fail(file, `DOM global ${node.text} requires manual guarded web module, not cross-platform code`);
        if (ts.isJsxAttribute(node) && ["className", "onClick", "onMouseEnter"].includes(node.name.getText(ast))) fail(file, `DOM JSX attribute ${node.name.getText(ast)} forbidden`);
        if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && /^[a-z]/.test(node.tagName.getText(ast))) fail(file, `DOM JSX element ${node.tagName.getText(ast)} forbidden`);
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "registerUsageSource" && range && semver.satisfies("0.9.2", range)) fail(file, "usage sources require Paseo >=0.9.3; declared range accepts 0.9.2");
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  warnings.push("Static preflight only. Typecheck, actual host loader, schemas, secrets, accessibility, resource cleanup and behavior still require verification.");
  return { ok: errors.length === 0, root, errors, warnings: [...new Set(warnings)] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let jsonOutput = false;
  try {
    const args = process.argv.slice(2);
    const input = args.shift();
    if (!input || input.startsWith("--")) throw new Error("Usage: node validate-plugin.mjs <plugin-directory> [--daemon-version x] [--client-version x] [--json]");
    const options = {};
    while (args.length) {
      const arg = args.shift();
      if (arg === "--json") jsonOutput = true;
      else if (["--daemon-version", "--client-version"].includes(arg)) {
        const value = args.shift();
        if (!value || !semver.valid(value)) throw new Error(`Invalid or missing version for ${arg}`);
        options[arg === "--daemon-version" ? "daemonVersion" : "clientVersion"] = value;
      } else throw new Error(`Unknown argument ${arg}`);
    }
    const result = validatePlugin(input, options);
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else {
      for (const error of result.errors) console.error(error);
      for (const warning of result.warnings) console.log(`Warning: ${warning}`);
      console.log(`${result.ok ? "PASS" : "FAIL"}: ${result.root}`);
    }
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonOutput) console.log(JSON.stringify({ ok: false, errors: [message], warnings: [] }));
    else console.error(message);
    process.exitCode = 1;
  }
}
