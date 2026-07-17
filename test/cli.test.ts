import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cliPath = fileURLToPath(new URL("../src/cli.js", import.meta.url));

function cleanEnvironment(home: string): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, HOME: home };
  delete environment.STRAPIVO_URL;
  delete environment.STRAPIVO_API_TOKEN;
  return environment;
}

test("CLI usage is JSON on stdout", () => {
  const result = spawnSync(process.execPath, [cliPath, "usage"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout) as { name: string; protocol: { prompts: boolean } };
  assert.equal(output.name, "strapivo");
  assert.equal(output.protocol.prompts, false);
});

test("CLI failures are structured JSON on stderr", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "strapivo-cli-home-"));
  t.after(() => rm(home, { recursive: true, force: true }));

  const result = spawnSync(process.execPath, [cliPath, "workspaces", "list"], {
    encoding: "utf8",
    env: cleanEnvironment(home),
  });

  assert.equal(result.status, 3);
  assert.equal(result.stdout, "");
  const output = JSON.parse(result.stderr) as { error: { code: string; retryable: boolean } };
  assert.equal(output.error.code, "config_missing");
  assert.equal(output.error.retryable, false);
});

test("config set reads token from stdin and config show redacts it", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "strapivo-cli-home-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const env = cleanEnvironment(home);

  const baseUrlResult = spawnSync(
    process.execPath,
    [cliPath, "config", "set", "--base-url", "https://strapivo.example"],
    { encoding: "utf8", env },
  );
  assert.equal(baseUrlResult.status, 0, baseUrlResult.stderr);

  const tokenResult = spawnSync(process.execPath, [cliPath, "config", "set", "--token-stdin"], {
    encoding: "utf8",
    env,
    input: "secret-token\n",
  });
  assert.equal(tokenResult.status, 0, tokenResult.stderr);
  assert.doesNotMatch(tokenResult.stdout, /secret-token/);

  const showResult = spawnSync(process.execPath, [cliPath, "config"], { encoding: "utf8", env });
  assert.equal(showResult.status, 0, showResult.stderr);
  const shown = JSON.parse(showResult.stdout) as {
    base_url: string;
    api_token: string;
    configured: boolean;
  };
  assert.equal(shown.base_url, "https://strapivo.example/");
  assert.equal(shown.api_token, "[REDACTED]");
  assert.equal(shown.configured, true);

  const path = join(home, ".config", "strapivo", "config.json");
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), {
    base_url: "https://strapivo.example/",
    api_token: "secret-token",
  });
  assert.equal((await stat(path)).mode & 0o777, 0o600);
});

test("invalid command arguments are reported before missing config", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "strapivo-cli-home-"));
  t.after(() => rm(home, { recursive: true, force: true }));

  const result = spawnSync(
    process.execPath,
    [cliPath, "business-model", "read", "--workspace", "acme"],
    { encoding: "utf8", env: cleanEnvironment(home) },
  );

  assert.equal(result.status, 2);
  const output = JSON.parse(result.stderr) as { error: { code: string; message: string } };
  assert.equal(output.error.code, "invalid_arguments");
  assert.match(output.error.message, /--id is required/);
});

test("unknown command exits with usage code", () => {
  const result = spawnSync(process.execPath, [cliPath, "invented"], { encoding: "utf8" });

  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  const output = JSON.parse(result.stderr) as { error: { code: string } };
  assert.equal(output.error.code, "unknown_command");
});
