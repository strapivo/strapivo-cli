import { readFileSync } from "node:fs";
import { CliError, ExitCode } from "./errors.js";
import { BUSINESS_MODEL_BLOCKS, CHILD_TYPES_BY_BLOCK } from "./validation.js";

const commands = {
  config: {
    description: "Show or update ~/.config/strapivo/config.json",
    commands: {
      show: { usage: "strapivo config", description: "Show effective config with API token redacted" },
      set: {
        usage: "strapivo config set [--base-url URL] [--token-stdin]",
        description: "Atomically update config; unspecified fields remain unchanged",
      },
      path: { usage: "strapivo config path", description: "Show config file path" },
      reset: { usage: "strapivo config reset", description: "Remove config file; environment fallback remains" },
    },
  },
  skill: {
    description: "Install the bundled Strapivo skill for supported agents",
    commands: {
      install: {
        usage: "strapivo skill install [--host codex|claude|all]",
        description: "Install personal skill for Codex, Claude Code, or both; default all",
      },
    },
  },
  workspaces: {
    description: "Discover accessible Workspaces",
    commands: {
      list: { usage: "strapivo workspaces list" },
    },
  },
  "business-models": {
    description: "List Business Models in one Workspace",
    commands: {
      list: { usage: "strapivo business-models list --workspace SLUG" },
    },
  },
  "business-model": {
    description: "Read or write one Business Model",
    commands: {
      read: { usage: "strapivo business-model read --workspace SLUG --id ID" },
      write: {
        usage: "strapivo business-model write --workspace SLUG --input FILE|-",
        input: {
          business_model_id: "string|null; null creates, string updates",
          lock_version: "non-negative integer|null; latest read version for updates",
          name: "complete non-empty string",
          url: "complete string|null",
          context_notes: "complete string|null",
        },
      },
    },
  },
  "business-model-element": {
    description: "Read, write, archive, or reject one Business Model Element",
    commands: {
      read: {
        usage:
          "strapivo business-model-element read --workspace SLUG --business-model-id ID --element-id ID",
      },
      write: {
        usage: "strapivo business-model-element write --workspace SLUG --input FILE|-",
        input: {
          business_model_id: "Business Model ID",
          block: BUSINESS_MODEL_BLOCKS,
          element_id: "string|null; null creates, string updates",
          parent_id: "string|null; required with child_type when creating a child",
          child_type: {
            customer_segments: CHILD_TYPES_BY_BLOCK.customer_segments,
            value_propositions: CHILD_TYPES_BY_BLOCK.value_propositions,
          },
          lock_version: "non-negative integer|null; latest read version for updates",
          title: "complete non-empty string",
          details: "complete string",
        },
      },
      archive: {
        usage: "strapivo business-model-element archive --workspace SLUG --input FILE|-",
        description: "Archive an accepted element; accepted children are archived with their parent",
        input: {
          business_model_id: "Business Model ID",
          element_id: "accepted Business Model Element ID",
          lock_version: "non-negative integer; latest read version",
          archive_reason: "string|null; optional reason, represented explicitly",
        },
      },
      reject: {
        usage: "strapivo business-model-element reject --workspace SLUG --input FILE|-",
        description: "Permanently delete a proposed element that was never accepted",
        input: {
          business_model_id: "Business Model ID",
          element_id: "proposed Business Model Element ID",
          lock_version: "non-negative integer; latest read version",
        },
      },
    },
  },
} as const;

export function rootUsage(): Record<string, unknown> {
  return {
    name: "strapivo",
    version: packageVersion(),
    description: "Machine-first CLI for Strapivo Strategic Memory",
    protocol: {
      success: "JSON on stdout with exit code 0",
      failure: "Structured JSON error on stderr with nonzero exit code",
      prompts: false,
    },
    commands: Object.fromEntries(
      Object.entries(commands).map(([name, command]) => [name, command.description]),
    ),
    discovery: ["strapivo usage", "strapivo <command> usage"],
  };
}

export function commandUsage(name: string): unknown {
  if (!Object.hasOwn(commands, name)) {
    throw new CliError("unknown_command", `Unknown command '${name}'`, ExitCode.usage, {
      details: { commands: Object.keys(commands) },
    });
  }
  return commands[name as keyof typeof commands];
}

export function packageVersion(): string {
  const version = packageMetadata().version;
  return typeof version === "string" ? version : "unknown";
}

export function apiContractVersion(): string {
  const apiContract = packageMetadata().strapivo?.apiContract;
  return typeof apiContract === "string" ? apiContract : "unknown";
}

function packageMetadata(): {
  version?: unknown;
  strapivo?: { apiContract?: unknown };
} {
  try {
    return JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      version?: unknown;
      strapivo?: { apiContract?: unknown };
    };
  } catch {
    return {};
  }
}
