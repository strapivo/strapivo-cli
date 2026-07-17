import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  configView,
  effectiveConfig,
  readStoredConfig,
  resetStoredConfig,
  updateStoredConfig,
  validateBaseUrl,
} from "../src/config.js";
import { CliError } from "../src/errors.js";

async function temporaryConfig(): Promise<{ directory: string; path: string }> {
  const directory = await mkdtemp(join(tmpdir(), "strapivo-cli-"));
  return { directory, path: join(directory, ".config", "strapivo", "config.json") };
}

test("config fields override matching environment variables", async (t) => {
  const { directory, path } = await temporaryConfig();
  t.after(() => rm(directory, { recursive: true, force: true }));
  await updateStoredConfig({ base_url: "https://configured.example", api_token: "configured-token" }, path);

  const config = await effectiveConfig(path, {
    STRAPIVO_URL: "https://environment.example",
    STRAPIVO_API_TOKEN: "environment-token",
  });

  assert.equal(config.baseUrl, "https://configured.example/");
  assert.equal(config.apiToken, "configured-token");
});

test("missing config fields fall back to environment variables", async (t) => {
  const { directory, path } = await temporaryConfig();
  t.after(() => rm(directory, { recursive: true, force: true }));
  await updateStoredConfig({ base_url: "https://configured.example" }, path);

  const config = await effectiveConfig(path, {
    STRAPIVO_API_TOKEN: "environment-token",
  });

  assert.equal(config.baseUrl, "https://configured.example/");
  assert.equal(config.apiToken, "environment-token");
});

test("config writes atomically, preserves fields, and restricts file permissions", async (t) => {
  const { directory, path } = await temporaryConfig();
  t.after(() => rm(directory, { recursive: true, force: true }));

  await updateStoredConfig({ base_url: "https://strapivo.example" }, path);
  await updateStoredConfig({ api_token: "secret-token" }, path);

  assert.deepEqual(await readStoredConfig(path), {
    base_url: "https://strapivo.example/",
    api_token: "secret-token",
  });
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal((await stat(join(directory, ".config", "strapivo"))).mode & 0o777, 0o700);
  assert.doesNotMatch(await readFile(path, "utf8"), /environment-token/);
});

test("config view redacts token and reports sources", async (t) => {
  const { directory, path } = await temporaryConfig();
  t.after(() => rm(directory, { recursive: true, force: true }));
  await updateStoredConfig({ api_token: "secret-token" }, path);

  assert.deepEqual(await configView(path, { STRAPIVO_URL: "https://strapivo.example" }), {
    path,
    base_url: "https://strapivo.example/",
    api_token: "[REDACTED]",
    configured: true,
    sources: {
      base_url: "environment",
      api_token: "config",
    },
  });
});

test("config reset repairs an unreadable JSON configuration", async (t) => {
  const { directory, path } = await temporaryConfig();
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, ".config", "strapivo"), { recursive: true });
  await writeFile(path, "not json", "utf8");

  await resetStoredConfig(path);

  assert.deepEqual(await readStoredConfig(path), {});
});

test("plain HTTP is accepted only for localhost", () => {
  assert.equal(validateBaseUrl("http://localhost:3000"), "http://localhost:3000/");
  assert.throws(
    () => validateBaseUrl("http://strapivo.example"),
    (error: unknown) => error instanceof CliError && error.code === "config_invalid",
  );
});
