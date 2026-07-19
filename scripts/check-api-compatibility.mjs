#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parse } from "yaml";

const packagePath = fileURLToPath(new URL("../package.json", import.meta.url));
const packageDocument = JSON.parse(readFileSync(packagePath, "utf8"));
const supportedContract = packageDocument.strapivo?.apiContract;
if (typeof supportedContract !== "string") {
  console.error("API compatibility check failed: package.json strapivo.apiContract is missing");
  process.exit(1);
}

const baselinePath = fileURLToPath(new URL("../contract/strapivo-openapi.yaml", import.meta.url));
const candidatePath = resolve(process.argv[2] ?? baselinePath);
const diffTool = fileURLToPath(
  new URL("../node_modules/@pb33f/openapi-changes/bin/openapi-changes.js", import.meta.url),
);

const requiredOperations = [
  ["GET", "/workspaces.json", "listWorkspaces"],
  ["GET", "/{workspace_slug}/business_models.json", "listBusinessModels"],
  ["POST", "/{workspace_slug}/business_models.json", "createBusinessModel"],
  ["GET", "/{workspace_slug}/business_models/{business_model_id}.json", "getBusinessModel"],
  ["PATCH", "/{workspace_slug}/business_models/{business_model_id}.json", "updateBusinessModel"],
  ["POST", "/{workspace_slug}/business_models/{business_model_id}/elements.json", "createBusinessModelElement"],
  ["GET", "/{workspace_slug}/business_models/{business_model_id}/elements/{element_id}.json", "getBusinessModelElement"],
  ["PATCH", "/{workspace_slug}/business_models/{business_model_id}/elements/{element_id}.json", "updateBusinessModelElement"],
  ["POST", "/{workspace_slug}/business_models/{business_model_id}/elements/{element_id}/archival.json", "archiveBusinessModelElement"],
  ["DELETE", "/{workspace_slug}/business_models/{business_model_id}/elements/{element_id}/rejection.json", "rejectBusinessModelElement"],
];

function fail(message) {
  console.error(`API compatibility check failed: ${message}`);
  process.exit(1);
}

function documentAt(path) {
  let document;
  try {
    document = parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof document !== "object" || document === null || Array.isArray(document)) {
    fail(`${path} is not an OpenAPI object`);
  }
  return document;
}

const candidate = documentAt(candidatePath);
const contractVersion = candidate.info?.version;
if (typeof contractVersion !== "string") fail("candidate info.version is missing");

const [supportedMajor, supportedMinor] = supportedContract.split(".").map(Number);
const [candidateMajor, candidateMinor] = contractVersion.split(".").map(Number);
if (candidateMajor !== supportedMajor || !Number.isInteger(candidateMinor) || candidateMinor < supportedMinor) {
  fail(`CLI supports API ${supportedContract}; candidate declares ${contractVersion}`);
}

for (const [method, path, operationId] of requiredOperations) {
  const operation = candidate.paths?.[path]?.[method.toLowerCase()];
  if (typeof operation !== "object" || operation === null) {
    fail(`missing ${method} ${path}`);
  }
  if (operation.operationId !== operationId) {
    fail(`${method} ${path} must use operationId '${operationId}', found '${String(operation.operationId)}'`);
  }
}

const diff = spawnSync(
  process.execPath,
  [diffTool, "report", "--reproducible", baselinePath, candidatePath],
  { encoding: "utf8" },
);
if (diff.status !== 0) {
  fail(`OpenAPI diff tool failed${diff.stderr.trim() === "" ? "" : `: ${diff.stderr.trim()}`}`);
}

let report;
try {
  report = JSON.parse(diff.stdout);
} catch {
  fail("OpenAPI diff tool returned invalid JSON");
}

const changes = Array.isArray(report.changes) ? report.changes : [];
const breaking = changes.filter((change) => change?.breaking === true);
if (breaking.length > 0) {
  for (const change of breaking) {
    console.error(`BREAKING: ${change.path ?? "unknown path"}: ${change.changeText ?? "changed"} ${change.property ?? ""}`.trim());
  }
  fail(`${breaking.length} breaking OpenAPI change${breaking.length === 1 ? "" : "s"}`);
}

console.log(
  `API ${contractVersion} compatible with CLI contract ${supportedContract}: ${requiredOperations.length} operations checked, ${changes.length} non-breaking change${changes.length === 1 ? "" : "s"}`,
);
