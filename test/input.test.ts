import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { CliError } from "../src/errors.js";
import { readJsonInput } from "../src/input.js";

test("oversized stdin preserves input_too_large error", async () => {
  const stdin = Readable.from(Buffer.alloc(1024 * 1024 + 1, "x"));

  await assert.rejects(
    readJsonInput("-", stdin),
    (error: unknown) => error instanceof CliError && error.code === "input_too_large",
  );
});
