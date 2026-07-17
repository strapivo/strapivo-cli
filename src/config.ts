import { chmod, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { CliError, ExitCode } from "./errors.js";

export interface StoredConfig {
  base_url?: string;
  api_token?: string;
}

export interface EffectiveConfig {
  baseUrl: string;
  apiToken: string;
}

export interface ConfigView {
  path: string;
  base_url: string | null;
  api_token: "[REDACTED]" | null;
  configured: boolean;
  sources: {
    base_url: "config" | "environment" | null;
    api_token: "config" | "environment" | null;
  };
}

const CONFIG_KEYS = new Set(["base_url", "api_token"]);

export function configFilePath(homeDirectory = homedir()): string {
  return join(homeDirectory, ".config", "strapivo", "config.json");
}

export async function readStoredConfig(path = configFilePath()): Promise<StoredConfig> {
  let contents: string;

  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return {};
    throw new CliError("config_unreadable", `Could not read config at ${path}`, ExitCode.config, { cause: error });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new CliError("config_invalid", `Config at ${path} is not valid JSON`, ExitCode.config, { cause: error });
  }

  if (!isRecord(parsed) || Array.isArray(parsed)) {
    throw new CliError("config_invalid", "Config must be a JSON object", ExitCode.config);
  }

  const unknownKeys = Object.keys(parsed).filter((key) => !CONFIG_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw new CliError("config_invalid", "Config contains unsupported fields", ExitCode.config, {
      details: { fields: unknownKeys },
    });
  }

  const stored: StoredConfig = {};
  if ("base_url" in parsed) stored.base_url = validateBaseUrl(parsed.base_url);
  if ("api_token" in parsed) stored.api_token = validateApiToken(parsed.api_token);
  return stored;
}

export async function effectiveConfig(
  path = configFilePath(),
  environment: NodeJS.ProcessEnv = process.env,
): Promise<EffectiveConfig> {
  const stored = await readStoredConfig(path);
  const baseUrlValue = stored.base_url ?? environment.STRAPIVO_URL;
  const apiTokenValue = stored.api_token ?? environment.STRAPIVO_API_TOKEN;

  const missing: string[] = [];
  if (baseUrlValue === undefined) missing.push("base_url");
  if (apiTokenValue === undefined) missing.push("api_token");

  if (missing.length > 0) {
    throw new CliError(
      "config_missing",
      "Strapivo API configuration is incomplete. Run 'strapivo config set'.",
      ExitCode.config,
      { details: { fields: missing, path } },
    );
  }

  return {
    baseUrl: validateBaseUrl(baseUrlValue),
    apiToken: validateApiToken(apiTokenValue),
  };
}

export async function configView(
  path = configFilePath(),
  environment: NodeJS.ProcessEnv = process.env,
): Promise<ConfigView> {
  const stored = await readStoredConfig(path);
  const envBaseUrl = environment.STRAPIVO_URL;
  const envApiToken = environment.STRAPIVO_API_TOKEN;
  const baseUrl = stored.base_url ?? (envBaseUrl === undefined ? undefined : validateBaseUrl(envBaseUrl));
  const apiToken = stored.api_token ?? (envApiToken === undefined ? undefined : validateApiToken(envApiToken));

  return {
    path,
    base_url: baseUrl ?? null,
    api_token: apiToken === undefined ? null : "[REDACTED]",
    configured: baseUrl !== undefined && apiToken !== undefined,
    sources: {
      base_url: stored.base_url !== undefined ? "config" : envBaseUrl !== undefined ? "environment" : null,
      api_token: stored.api_token !== undefined ? "config" : envApiToken !== undefined ? "environment" : null,
    },
  };
}

export async function resetStoredConfig(path = configFilePath()): Promise<void> {
  try {
    await rm(path, { force: true });
  } catch (error) {
    throw new CliError("config_unwritable", `Could not remove config at ${path}`, ExitCode.config, { cause: error });
  }
}

export async function updateStoredConfig(
  updates: StoredConfig,
  path = configFilePath(),
): Promise<StoredConfig> {
  const current = await readStoredConfig(path);
  const next: StoredConfig = { ...current };

  if (updates.base_url !== undefined) next.base_url = validateBaseUrl(updates.base_url);
  if (updates.api_token !== undefined) next.api_token = validateApiToken(updates.api_token);

  if (Object.keys(next).length === 0) {
    throw new CliError("config_unchanged", "No configuration value was provided", ExitCode.usage);
  }

  const directory = dirname(path);
  const temporaryPath = join(directory, `.config.json.${process.pid}.${randomUUID()}.tmp`);

  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    const file = await open(temporaryPath, "wx", 0o600);
    try {
      await file.writeFile(`${JSON.stringify(next, null, 2)}\n`, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporaryPath, path);
    await chmod(path, 0o600);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    if (error instanceof CliError) throw error;
    throw new CliError("config_unwritable", `Could not write config at ${path}`, ExitCode.config, { cause: error });
  }

  return next;
}

export function validateBaseUrl(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CliError("config_invalid", "base_url must be a non-empty URL", ExitCode.config);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new CliError("config_invalid", "base_url must be a valid URL", ExitCode.config, { cause: error });
  }

  if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
    throw new CliError(
      "config_invalid",
      "base_url cannot contain credentials, query parameters, or a fragment",
      ExitCode.config,
    );
  }

  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhost(url.hostname))) {
    throw new CliError("config_invalid", "base_url must use HTTPS except on localhost", ExitCode.config);
  }

  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.toString();
}

export function validateApiToken(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || /\s/.test(value)) {
    throw new CliError("config_invalid", "api_token must be one non-whitespace token", ExitCode.config);
  }
  return value;
}

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
