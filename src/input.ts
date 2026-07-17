import { readFile } from "node:fs/promises";
import type { Readable } from "node:stream";
import { CliError, ExitCode } from "./errors.js";

const MAX_INPUT_BYTES = 1024 * 1024;

export async function readJsonInput(path: string, stdin: Readable): Promise<Record<string, unknown>> {
  let contents: string;

  try {
    contents = path === "-" ? await readStream(stdin) : await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError("input_unreadable", `Could not read input from ${path}`, ExitCode.usage, { cause: error });
  }

  if (Buffer.byteLength(contents) > MAX_INPUT_BYTES) {
    throw new CliError("input_too_large", "Input exceeds the 1 MiB limit", ExitCode.usage);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new CliError("input_invalid_json", "Input is not valid JSON", ExitCode.usage, { cause: error });
  }

  if (!isRecord(parsed) || Array.isArray(parsed)) {
    throw new CliError("input_invalid", "Input must be a JSON object", ExitCode.usage);
  }

  return parsed;
}

async function readStream(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    bytes += buffer.length;
    if (bytes > MAX_INPUT_BYTES) {
      throw new CliError("input_too_large", "Input exceeds the 1 MiB limit", ExitCode.usage);
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
