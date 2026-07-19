import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const checkerPath = new URL("../../scripts/check-api-compatibility.mjs", import.meta.url);
const contractPath = new URL("../../contract/strapivo-openapi.yaml", import.meta.url);

test("API compatibility check rejects breaking schema changes", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "strapivo-api-check-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const candidatePath = join(directory, "breaking.yaml");
  const contract = await readFile(contractPath, "utf8");
  await writeFile(candidatePath, contract.replace("enum: [owner, admin, member]", "enum: [owner, admin]"));

  const result = spawnSync(process.execPath, [checkerPath.pathname, candidatePath], { encoding: "utf8" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /BREAKING:/);
  assert.match(result.stderr, /breaking OpenAPI change/);
});

test("API compatibility check rejects missing CLI operations", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "strapivo-api-check-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const candidatePath = join(directory, "missing-operation.yaml");
  const contract = await readFile(contractPath, "utf8");
  await writeFile(candidatePath, contract.replace("operationId: listWorkspaces", "operationId: renamedListWorkspaces"));

  const result = spawnSync(process.execPath, [checkerPath.pathname, candidatePath], { encoding: "utf8" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must use operationId 'listWorkspaces'/);
});
