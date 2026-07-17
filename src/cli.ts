#!/usr/bin/env node

import { defaultCommandContext, runCommand } from "./commands.js";
import { normalizeError } from "./errors.js";
import { writeJson } from "./output.js";

const context = defaultCommandContext();

try {
  await runCommand(process.argv.slice(2), context);
} catch (error) {
  const normalized = normalizeError(error);
  writeJson(context.stderr, normalized.asJson());
  process.exitCode = normalized.exitCode;
}
