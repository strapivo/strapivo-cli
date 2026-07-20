import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const packageArgument = process.argv[2];
if (!packageArgument) {
  console.error("Usage: node scripts/smoke-package.mjs <package.tgz>");
  process.exit(2);
}

const packagePath = resolve(packageArgument);
const directory = await mkdtemp(join(tmpdir(), "strapivo-package-smoke-"));
const homeDirectory = join(directory, "home");
const installRoot = join(directory, "prefix");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const cliPath = join(installRoot, "bin", process.platform === "win32" ? "strapivo.cmd" : "strapivo");
const environment = { ...process.env, HOME: homeDirectory, USERPROFILE: homeDirectory };

try {
  await mkdir(homeDirectory, { recursive: true });
  run(npmCommand, ["install", "--global", "--prefix", installRoot, packagePath], environment);

  const version = runJson(cliPath, ["version"], environment);
  assert.equal(version.name, "@strapivo/cli");
  assert.equal(version.version, "2.0.0");
  assert.equal(version.api_contract, "1.2");

  const usage = runJson(cliPath, ["usage"], environment);
  assert.equal(usage.name, "strapivo");
  assert.equal(typeof usage.commands["business-model-stream"], "string");
  assert.equal(typeof usage.commands["business-model-stream-membership"], "string");

  const streamUsage = runJson(cliPath, ["business-model-stream", "usage"], environment);
  assert.equal(typeof streamUsage.commands.write, "object");

  const agents = runJson(cliPath, ["skill", "install", "--host", "agents"], environment);
  assert.deepEqual(agents.installed.map(({ host }) => host), ["agents"]);

  const all = runJson(cliPath, ["skill", "install", "--host", "all"], environment);
  assert.deepEqual(all.installed.map(({ host }) => host), ["codex", "claude"]);

  await verifyManagedSkill(join(homeDirectory, ".agents", "skills", "strapivo"));
  await verifyManagedSkill(join(homeDirectory, ".claude", "skills", "strapivo"));

  console.log(`Package smoke test passed: ${basename(packagePath)}`);
} finally {
  await rm(directory, { recursive: true, force: true });
}

function run(command, arguments_, env) {
  const result = spawnSync(command, arguments_, { cwd: directory, encoding: "utf8", env });
  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${command} exited with status ${result.status ?? "unknown"}`);
  }
  return result.stdout;
}

function runJson(command, arguments_, env) {
  const output = run(command, arguments_, env);
  return JSON.parse(output);
}

async function verifyManagedSkill(directoryPath) {
  assert.equal((await stat(join(directoryPath, "SKILL.md"))).isFile(), true);
  const marker = JSON.parse(await readFile(join(directoryPath, ".strapivo-managed.json"), "utf8"));
  assert.deepEqual(marker, { managed_by: "@strapivo/cli", skill: "strapivo" });
}
