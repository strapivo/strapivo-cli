import { homedir } from "node:os";
import { parseArgs } from "node:util";
import type { Readable, Writable } from "node:stream";
import { ApiClient } from "./api.js";
import {
  configFilePath,
  configView,
  effectiveConfig,
  resetStoredConfig,
  updateStoredConfig,
  validateApiToken,
} from "./config.js";
import { CliError, ExitCode } from "./errors.js";
import { readJsonInput } from "./input.js";
import { writeJson } from "./output.js";
import { installSkill, validateSkillHost } from "./skill.js";
import { apiContractVersion, commandUsage, packageVersion, rootUsage } from "./usage.js";
import {
  identifier,
  validateBusinessModelElementArchiveInput,
  validateBusinessModelElementRejectInput,
  validateBusinessModelElementWriteInput,
  validateBusinessModelStreamMembershipWriteInput,
  validateBusinessModelStreamWriteInput,
  validateBusinessModelWriteInput,
} from "./validation.js";

export interface CommandContext {
  stdin: Readable;
  stdout: Writable;
  stderr: Writable;
  environment: NodeJS.ProcessEnv;
  configPath: string;
  homeDirectory: string;
  fetchImpl: typeof globalThis.fetch;
}

export function defaultCommandContext(): CommandContext {
  return {
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    environment: process.env,
    configPath: configFilePath(),
    homeDirectory: homedir(),
    fetchImpl: globalThis.fetch,
  };
}

export async function runCommand(argv: string[], context: CommandContext): Promise<void> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    writeJson(context.stdout, rootUsage());
    return;
  }

  if (argv[0] === "--version") {
    writeJson(context.stdout, versionOutput());
    return;
  }

  const [domain, action, ...rest] = argv;
  if (domain === undefined) throw usageError("A command is required");

  if (domain === "usage") {
    if (action === undefined) writeJson(context.stdout, rootUsage());
    else {
      if (rest.length > 0) throw usageError("usage accepts at most one command name");
      writeJson(context.stdout, commandUsage(action));
    }
    return;
  }

  if (action === "usage") {
    if (rest.length > 0) throw usageError("Command usage accepts no additional arguments");
    writeJson(context.stdout, commandUsage(domain));
    return;
  }

  if (domain === "version") {
    if (action !== undefined) throw usageError("version accepts no arguments");
    writeJson(context.stdout, versionOutput());
    return;
  }

  if (domain === "config") {
    await runConfig(action, rest, context);
    return;
  }

  if (domain === "skill") {
    await runSkill(action, rest, context);
    return;
  }

  const knownApiCommand =
    (domain === "workspaces" && action === "list") ||
    (domain === "business-models" && action === "list") ||
    (domain === "business-model" && (action === "read" || action === "write")) ||
    (domain === "business-model-element" &&
      (action === "read" || action === "write" || action === "archive" || action === "reject")) ||
    (domain === "business-model-stream" && action === "write") ||
    (domain === "business-model-stream-membership" && action === "write");
  if (!knownApiCommand) {
    throw new CliError("unknown_command", `Unknown command '${[domain, action].filter(Boolean).join(" ")}'`, ExitCode.usage, {
      details: { instruction: "Run 'strapivo usage'" },
    });
  }

  if (domain === "workspaces" && action === "list") {
    assertNoArguments(rest);
    const api = await apiClient(context);
    writeJson(context.stdout, await api.listWorkspaces());
    return;
  }

  if (domain === "business-models" && action === "list") {
    const values = argumentsFor(rest, { workspace: { type: "string" } });
    const workspace = requiredOption(values, "workspace");
    const api = await apiClient(context);
    writeJson(context.stdout, await api.listBusinessModels(workspace));
    return;
  }

  if (domain === "business-model" && action === "read") {
    const values = argumentsFor(rest, {
      workspace: { type: "string" },
      id: { type: "string" },
    });
    const workspace = requiredOption(values, "workspace");
    const id = identifier(requiredOption(values, "id"), "id");
    const api = await apiClient(context);
    writeJson(context.stdout, await api.readBusinessModel(workspace, id));
    return;
  }

  if (domain === "business-model" && action === "write") {
    const values = argumentsFor(rest, {
      workspace: { type: "string" },
      input: { type: "string" },
    });
    const workspace = requiredOption(values, "workspace");
    const inputPath = requiredOption(values, "input");
    const input = validateBusinessModelWriteInput(await readJsonInput(inputPath, context.stdin));
    const api = await apiClient(context);
    writeJson(context.stdout, await api.writeBusinessModel(workspace, input));
    return;
  }

  if (domain === "business-model-element" && action === "read") {
    const values = argumentsFor(rest, {
      workspace: { type: "string" },
      "business-model-id": { type: "string" },
      "element-id": { type: "string" },
    });
    const workspace = requiredOption(values, "workspace");
    requiredOption(values, "business-model-id");
    requiredOption(values, "element-id");
    const api = await apiClient(context);
    writeJson(
      context.stdout,
      await api.readBusinessModelElement(
        workspace,
        identifier(requiredOption(values, "business-model-id"), "business-model_id"),
        identifier(requiredOption(values, "element-id"), "element_id"),
      ),
    );
    return;
  }

  if (domain === "business-model-element" && action === "write") {
    const values = argumentsFor(rest, {
      workspace: { type: "string" },
      input: { type: "string" },
    });
    const workspace = requiredOption(values, "workspace");
    const inputPath = requiredOption(values, "input");
    const input = validateBusinessModelElementWriteInput(await readJsonInput(inputPath, context.stdin));
    const api = await apiClient(context);
    writeJson(context.stdout, await api.writeBusinessModelElement(workspace, input));
    return;
  }

  if (domain === "business-model-element" && action === "archive") {
    const values = argumentsFor(rest, {
      workspace: { type: "string" },
      input: { type: "string" },
    });
    const workspace = requiredOption(values, "workspace");
    const inputPath = requiredOption(values, "input");
    const input = validateBusinessModelElementArchiveInput(await readJsonInput(inputPath, context.stdin));
    const api = await apiClient(context);
    writeJson(context.stdout, await api.archiveBusinessModelElement(workspace, input));
    return;
  }

  if (domain === "business-model-element" && action === "reject") {
    const values = argumentsFor(rest, {
      workspace: { type: "string" },
      input: { type: "string" },
    });
    const workspace = requiredOption(values, "workspace");
    const inputPath = requiredOption(values, "input");
    const input = validateBusinessModelElementRejectInput(await readJsonInput(inputPath, context.stdin));
    const api = await apiClient(context);
    writeJson(context.stdout, await api.rejectBusinessModelElement(workspace, input));
    return;
  }

  if (domain === "business-model-stream" && action === "write") {
    const values = argumentsFor(rest, {
      workspace: { type: "string" },
      input: { type: "string" },
    });
    const workspace = requiredOption(values, "workspace");
    const inputPath = requiredOption(values, "input");
    const input = validateBusinessModelStreamWriteInput(await readJsonInput(inputPath, context.stdin));
    const api = await apiClient(context);
    writeJson(context.stdout, await api.writeBusinessModelStream(workspace, input));
    return;
  }

  if (domain === "business-model-stream-membership" && action === "write") {
    const values = argumentsFor(rest, {
      workspace: { type: "string" },
      input: { type: "string" },
    });
    const workspace = requiredOption(values, "workspace");
    const inputPath = requiredOption(values, "input");
    const input = validateBusinessModelStreamMembershipWriteInput(
      await readJsonInput(inputPath, context.stdin),
    );
    const api = await apiClient(context);
    writeJson(context.stdout, await api.writeBusinessModelStreamMembership(workspace, input));
    return;
  }

  throw new CliError("unknown_command", `Unknown command '${[domain, action].filter(Boolean).join(" ")}'`, ExitCode.usage, {
    details: { instruction: "Run 'strapivo usage'" },
  });
}

async function runSkill(action: string | undefined, rest: string[], context: CommandContext): Promise<void> {
  if (action !== "install") {
    throw new CliError("unknown_command", `Unknown command 'skill${action === undefined ? "" : ` ${action}`}'`, ExitCode.usage, {
      details: { instruction: "Run 'strapivo skill usage'" },
    });
  }

  const values = argumentsFor(rest, { host: { type: "string" } });
  const host = validateSkillHost(values.host ?? "all");
  const installed = await installSkill({ host, homeDirectory: context.homeDirectory });
  writeJson(context.stdout, {
    installed,
    instruction: "Restart your agent if the Strapivo skill is not detected in the current session.",
  });
}

async function runConfig(action: string | undefined, rest: string[], context: CommandContext): Promise<void> {
  if (action === undefined || action === "show") {
    assertNoArguments(rest);
    writeJson(context.stdout, await configView(context.configPath, context.environment));
    return;
  }

  if (action === "path") {
    assertNoArguments(rest);
    writeJson(context.stdout, { path: context.configPath });
    return;
  }

  if (action === "reset") {
    assertNoArguments(rest);
    await resetStoredConfig(context.configPath);
    writeJson(context.stdout, await configView(context.configPath, context.environment));
    return;
  }

  if (action === "set") {
    const values = argumentsFor(rest, {
      "base-url": { type: "string" },
      "token-stdin": { type: "boolean" },
    });
    const baseUrl = values["base-url"];
    const tokenStdin = values["token-stdin"] === true;
    if (baseUrl === undefined && !tokenStdin) {
      throw usageError("config set requires --base-url and/or --token-stdin");
    }

    const updates: { base_url?: string; api_token?: string } = {};
    if (typeof baseUrl === "string") updates.base_url = baseUrl;
    if (tokenStdin) updates.api_token = await readToken(context.stdin);
    await updateStoredConfig(updates, context.configPath);
    writeJson(context.stdout, await configView(context.configPath, context.environment));
    return;
  }

  throw new CliError("unknown_command", `Unknown command 'config ${action}'`, ExitCode.usage, {
    details: { instruction: "Run 'strapivo config usage'" },
  });
}

async function apiClient(context: CommandContext): Promise<ApiClient> {
  const config = await effectiveConfig(context.configPath, context.environment);
  return new ApiClient({
    baseUrl: config.baseUrl,
    apiToken: config.apiToken,
    fetchImpl: context.fetchImpl,
    userAgent: `@strapivo/cli/${packageVersion()}`,
  });
}

async function readToken(stdin: Readable): Promise<string> {
  if ((stdin as Readable & { isTTY?: boolean }).isTTY === true) {
    throw usageError("--token-stdin requires a pipe or redirected stdin; interactive prompts are disabled");
  }

  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    bytes += buffer.length;
    if (bytes > 16 * 1024) throw usageError("API token input exceeds 16 KiB");
    chunks.push(buffer);
  }
  return validateApiToken(Buffer.concat(chunks).toString("utf8").trim());
}

function argumentsFor(
  args: string[],
  options: Record<string, { type: "string" | "boolean" }>,
): Record<string, string | boolean | undefined> {
  try {
    const parsed = parseArgs({ args, options, strict: true, allowPositionals: false });
    return parsed.values;
  } catch (error) {
    throw new CliError(
      "invalid_arguments",
      error instanceof Error ? error.message : "Invalid command arguments",
      ExitCode.usage,
      { cause: error },
    );
  }
}

function requiredOption(values: Record<string, string | boolean | undefined>, name: string): string {
  const value = values[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw usageError(`--${name} is required`);
  }
  return value;
}

function assertNoArguments(args: string[]): void {
  if (args.length > 0) throw usageError("This command accepts no additional arguments");
}

function usageError(message: string): CliError {
  return new CliError("invalid_arguments", message, ExitCode.usage, {
    details: { instruction: "Run 'strapivo usage'" },
  });
}

function versionOutput(): Record<string, unknown> {
  return {
    name: "@strapivo/cli",
    version: packageVersion(),
    api_contract: apiContractVersion(),
    node: process.version,
  };
}
