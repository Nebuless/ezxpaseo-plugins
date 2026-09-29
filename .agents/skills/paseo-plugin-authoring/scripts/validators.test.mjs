import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scripts = dirname(fileURLToPath(import.meta.url));

function fixture(files, check) {
  const root = mkdtempSync(join(tmpdir(), "paseo-skills-"));
  try {
    for (const [name, value] of Object.entries(files)) {
      mkdirSync(dirname(join(root, name)), { recursive: true });
      writeFileSync(join(root, name), value);
    }
    check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function run(script, ...args) {
  return spawnSync(process.execPath, [join(scripts, script), ...args], {
    encoding: "utf8",
    timeout: 15000,
  });
}

const skill = (frontmatter = "name: sample\ndescription: Create plugins. Use when creating plugins.", body = "# Sample\n\nRead [guide](references/guide.md).") => `---\n${frontmatter}\n---\n\n${body}\n`;

test("valid YAML skill and local resource links pass", () => {
  fixture({ "sample/SKILL.md": skill(), "sample/references/guide.md": "# Guide\n" }, (root) => {
    const result = run("validate-skills.mjs", root);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /1 skill/);
  });
});

test("skill naming, metadata and link failures produce nonzero diagnostics", () => {
  for (const [frontmatter, body, message] of [
    ["name: sample--bad\ndescription: x", "# Body", /name/],
    ["name: different\ndescription: x", "# Body", /directory/],
    ["name: sample\ndescription: ''", "# Body", /description/],
    ["name: sample\ndescription: x\nmetadata: { version: 1 }", "# Body", /metadata/],
    ["name: sample\ndescription: x\nunknown: x", "# Body", /unknown/],
    ["name: sample\ndescription: x\nname: sample", "# Body", /YAML/],
    ["name: sample\ndescription: x", "Read [missing](references/no.md).", /missing link/],
  ]) {
    fixture({ "sample/SKILL.md": skill(frontmatter, body) }, (root) => {
      const result = run("validate-skills.mjs", root);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, message);
    });
  }
});

const basePlugin = {
  "paseo-plugin.json": JSON.stringify({ id: "sample", requirements: { paseo: ">=0.9.2 <0.10.0" } }),
  "package.json": JSON.stringify({ name: "sample", private: true, type: "module", files: ["paseo-plugin.json", "index.server.ts", "index.client.tsx", "client/", "server/", "shared/"] }),
  "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true, noEmit: true, module: "ESNext", moduleResolution: "Bundler", lib: ["ES2023"], jsx: "react-jsx" } }),
  "index.server.ts": 'import type { PluginServerContext } from "@getpaseo/plugin/server";\nexport default function contribute(server: PluginServerContext) { return () => {}; }\n',
};

test("server-only plugin and stable-core prerelease compatibility pass", () => {
  fixture(basePlugin, (root) => {
    const result = run("validate-plugin.mjs", root, "--daemon-version", "0.9.2-beta.1", "--client-version", "0.7.0", "--json");
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.equal(JSON.parse(result.stdout).ok, true);
  });
});

test("client-only .ts entry accepted and incompatible app rejected", () => {
  const files = { ...basePlugin };
  delete files["index.server.ts"];
  files["index.client.ts"] = "export default function contribute() { return () => {}; }";
  files["package.json"] = JSON.stringify({ name: "sample", files: ["paseo-plugin.json", "index.client.ts"] });
  fixture(files, (root) => {
    const valid = run("validate-plugin.mjs", root);
    assert.equal(valid.status, 0, valid.stderr + valid.stdout);
    const result = run("validate-plugin.mjs", root, "--client-version", "0.9.1");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /client.*compatible/);
  });
});

test("manifest and entry defects rejected", () => {
  for (const [change, message] of [
    [{ "paseo-plugin.json": '{"id":"Sample","requirements":{"paseo":">=0.9.2"}}' }, /id/],
    [{ "paseo-plugin.json": '{"id":"sample"}' }, /requirements/],
    [{ "paseo-plugin.json": '{"id":"sample","requirements":{"paseo":"not-range"}}' }, /range/],
    [{ "paseo-plugin.json": '{"id":"sample","requirements":{"paseo":">=0.9.2","other":"x"}}' }, /requirement/],
    [{ "paseo-plugin.json": '{"id":"sample","requirements":{"paseo":">=0.9.2"},"build":["npm ci"]}' }, /argv/],
    [{ "index.server.tsx": "export default function contribute() { return () => {}; }" }, /duplicate/],
    [{ "root-helper.ts": "export const x = 1;" }, /root/],
    [{ "index.server.ts": "export const contribute = () => {};" }, /default/],
    [{ "tsconfig.json": '{"compilerOptions":{"lib":["ES2023","DOM"]}}' }, /DOM/],
  ]) {
    fixture({ ...basePlugin, ...change }, (root) => {
      const result = run("validate-plugin.mjs", root);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, message);
    });
  }
});

test("AST audit catches type imports, aliases, reexports, dynamic and transitive imports", () => {
  for (const [files, message] of [
    [{ "client/main.ts": 'import type { Stats } from "node:fs";' }, /Node/],
    [{ "client/main.ts": 'export * from "../server/helper";', "server/helper.ts": "export const x = 1;" }, /server/],
    [{ "client/main.ts": 'const z = import("zod/v4");' }, /host module/],
    [{ "shared/data.ts": 'import type { PluginClientContext } from "@getpaseo/plugin/client";' }, /shared/],
    [{ "client/main.ts": 'const fs = require("fs");' }, /Node/],
    [{ "client/main.ts": 'import "./web-helper";', "client/web-helper.ts": "document.title = 'bad';" }, /DOM/],
    [{ "client/main.ts": "const name = 'node:fs'; import(name);" }, /non-literal/],
    [{ "client/main.ts": 'import "@server/helper";', "server/helper.ts": "export {};", "tsconfig.json": '{"compilerOptions":{"paths":{"@server/*":["./server/*"]}}}' }, /server/],
    [{ "shared/data.d.ts": 'import type { ReadStream } from "node:fs";' }, /Node/],
  ]) {
    fixture({ ...basePlugin, ...files }, (root) => {
      const result = run("validate-plugin.mjs", root);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, message);
    });
  }
});

test("runtime directories allow nested files and ignore import-looking comments", () => {
  fixture({ ...basePlugin, "shared/nested/data.ts": '// import "node:fs";\nexport const data = "window.fake";', "server/helper.ts": 'import { readFile } from "node:fs/promises";' }, (root) => {
    const result = run("validate-plugin.mjs", root);
    assert.equal(result.status, 0, result.stderr + result.stdout);
  });
});

test("Node test files may live near client code but runtime imports cannot reach them", () => {
  const files = { ...basePlugin, "client/main.test.ts": 'import assert from "node:assert/strict"; export const x = 1;' };
  fixture(files, (root) => {
    const result = run("validate-plugin.mjs", root);
    assert.equal(result.status, 0, result.stderr + result.stdout);
  });
  fixture({ ...files, "client/main.ts": 'import { x } from "./main.test";' }, (root) => {
    const result = run("validate-plugin.mjs", root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /test code/);
  });
});

test("invalid CLI arguments and missing directories fail cleanly", () => {
  for (const args of [[], ["/does/not/exist"], ["--bogus"], [scripts, "--daemon-version", "bad"]]) {
    const result = run("validate-plugin.mjs", ...args);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.trim());
    assert.doesNotMatch(result.stderr, /at file:\/\//);
  }
});
