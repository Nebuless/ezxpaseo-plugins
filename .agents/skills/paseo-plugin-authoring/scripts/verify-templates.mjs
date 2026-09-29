import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import ts from "typescript";
import { build } from "esbuild";
import { validatePlugin } from "./validate-plugin.mjs";

const host = [
  "@getpaseo/plugin",
  "@getpaseo/plugin/*",
  "@getpaseo/client",
  "@getpaseo/client/*",
  "@getpaseo/protocol",
  "@getpaseo/protocol/*",
  "@tanstack/react-query",
  "react",
  "react/*",
  "react-native",
  "zod",
];

async function verifyTemplate(root) {
  const result = validatePlugin(root);
  if (!result.ok) throw new Error(result.errors.join("\n"));
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const require = createRequire(resolve(root, "package.json"));
  const expected = pkg.devDependencies?.["@getpaseo/plugin"];
  const sdkEntry = require.resolve("@getpaseo/plugin");
  const sdk = JSON.parse(
    readFileSync(resolve(dirname(sdkEntry), "../package.json"), "utf8"),
  );
  if (sdk.version !== expected)
    throw new Error(
      `SDK ${sdk.version} resolves, template requires ${expected}; install dependencies inside ${root}`,
    );
  const path = resolve(root, "tsconfig.json");
  const raw = ts.readConfigFile(path, ts.sys.readFile);
  if (raw.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(raw.error.messageText, "\n"),
    );
  const config = ts.parseJsonConfigFileContent(raw.config, ts.sys, root);
  const program = ts.createProgram(config.fileNames, {
    ...config.options,
    noEmit: true,
  });
  const diagnostics = [...config.errors, ...ts.getPreEmitDiagnostics(program)];
  if (diagnostics.length)
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => root,
        getCanonicalFileName: (name) => name,
        getNewLine: () => "\n",
      }),
    );
  for (const runtime of ["client", "server"]) {
    const entry = ["ts", "tsx"]
      .map((ext) => resolve(root, `index.${runtime}.${ext}`))
      .find(existsSync);
    if (entry)
      await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        logLevel: "silent",
        platform: runtime === "client" ? "browser" : "node",
        format: runtime === "client" ? "esm" : "cjs",
        external: host,
        tsconfig: path,
      });
  }
  const packed = await new Promise((accept, reject) => {
    const child = spawn(
      "npm",
      ["pack", "--dry-run", "--json", "--ignore-scripts"],
      {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30000,
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    child.on("error", reject);
    child.on("close", (status) => {
      if (status !== 0)
        reject(new Error(`npm pack exited ${status}: ${stderr}`));
      else {
        try {
          const parsed = JSON.parse(stdout);
          const artifact = Array.isArray(parsed) ? parsed[0] : parsed[pkg.name];
          accept(artifact.files.map((file) => file.path));
        } catch (error) {
          reject(error);
        }
      }
    });
  });
  const required = [];
  function collect(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git"].includes(entry.name)) continue;
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) collect(path);
      else if (
        /^(?:paseo-plugin\.json|index\.(?:client|server)\.tsx?)$/.test(
          entry.name,
        ) ||
        /\.(?:[cm]?[jt]sx?|svg)$/.test(entry.name)
      )
        required.push(relative(root, path).replaceAll("\\", "/"));
    }
  }
  collect(root);
  const missing = required.filter((file) => !packed.includes(file));
  if (missing.length)
    throw new Error(`npm artifact omits: ${missing.join(", ")}`);
  console.log(
    `PASS ${root}: static, SDK ${sdk.version}, TypeScript, offline bundle, npm pack (${packed.length} files)`,
  );
}

try {
  if (process.argv.length !== 3)
    throw new Error(
      "Usage: node verify-templates.mjs <skills-or-skill-directory>",
    );
  const suite = resolve(process.argv[2]);
  const templates = existsSync(resolve(suite, "SKILL.md"))
    ? [resolve(suite, "assets/template")].filter(existsSync)
    : readdirSync(suite, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => resolve(suite, entry.name, "assets/template"))
        .filter(existsSync);
  if (!templates.length)
    throw new Error("No assets/template directories found");
  let failed = 0;
  for (const template of templates) {
    try {
      await verifyTemplate(template);
    } catch (error) {
      failed++;
      console.error(
        `FAIL ${template}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  console.log(`${templates.length} templates checked, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
