#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { apiCompare } from "api-smart-diff";
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

const requiredOperations = [
  ["GET", "/workspaces.json", "listWorkspaces"],
  ["GET", "/{workspace_slug}/business_models.json", "listBusinessModels"],
  ["POST", "/{workspace_slug}/business_models.json", "createBusinessModel"],
  ["GET", "/{workspace_slug}/business_models/{business_model_id}.json", "getBusinessModel"],
  ["PATCH", "/{workspace_slug}/business_models/{business_model_id}.json", "updateBusinessModel"],
  ["GET", "/{workspace_slug}/business_models/{business_model_id}/environment.json", "getBusinessModelEnvironment"],
  ["PATCH", "/{workspace_slug}/business_models/{business_model_id}/environment.json", "updateBusinessModelEnvironment"],
  ["GET", "/{workspace_slug}/business_models/{business_model_id}/environment_items.json", "listBusinessModelEnvironmentItems"],
  ["POST", "/{workspace_slug}/business_models/{business_model_id}/environment_items.json", "createBusinessModelEnvironmentItem"],
  ["GET", "/{workspace_slug}/business_models/{business_model_id}/environment_items/{environment_item_id}.json", "getBusinessModelEnvironmentItem"],
  ["PATCH", "/{workspace_slug}/business_models/{business_model_id}/environment_items/{environment_item_id}.json", "updateBusinessModelEnvironmentItem"],
  ["POST", "/{workspace_slug}/business_models/{business_model_id}/environment_items/{environment_item_id}/archival.json", "archiveBusinessModelEnvironmentItem"],
  ["DELETE", "/{workspace_slug}/business_models/{business_model_id}/environment_items/{environment_item_id}/rejection.json", "rejectBusinessModelEnvironmentItem"],
  ["POST", "/{workspace_slug}/business_models/{business_model_id}/elements.json", "createBusinessModelElement"],
  ["GET", "/{workspace_slug}/business_models/{business_model_id}/elements/{element_id}.json", "getBusinessModelElement"],
  ["PATCH", "/{workspace_slug}/business_models/{business_model_id}/elements/{element_id}.json", "updateBusinessModelElement"],
  ["POST", "/{workspace_slug}/business_models/{business_model_id}/elements/{element_id}/archival.json", "archiveBusinessModelElement"],
  ["DELETE", "/{workspace_slug}/business_models/{business_model_id}/elements/{element_id}/rejection.json", "rejectBusinessModelElement"],
  ["POST", "/{workspace_slug}/business_models/{business_model_id}/streams.json", "createBusinessModelStream"],
  ["PATCH", "/{workspace_slug}/business_models/{business_model_id}/streams/{stream_id}.json", "updateBusinessModelStream"],
  ["POST", "/{workspace_slug}/business_models/{business_model_id}/streams/{stream_id}/memberships.json", "addBusinessModelStreamMembership"],
  ["DELETE", "/{workspace_slug}/business_models/{business_model_id}/streams/{stream_id}/memberships/{element_id}.json", "removeBusinessModelStreamMembership"],
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

const baseline = documentAt(baselinePath);
const candidate = documentAt(candidatePath);
const baselineVersion = baseline.info?.version;
if (typeof baselineVersion !== "string") fail("baseline info.version is missing");
const contractVersion = candidate.info?.version;
if (typeof contractVersion !== "string") fail("candidate info.version is missing");

const [supportedMajor, supportedMinor] = supportedContract.split(".").map(Number);
const [baselineMajor, baselineMinor] = baselineVersion.split(".").map(Number);
const [candidateMajor, candidateMinor] = contractVersion.split(".").map(Number);
if (!Number.isInteger(supportedMajor) || !Number.isInteger(supportedMinor)) {
  fail(`package.json strapivo.apiContract '${supportedContract}' is invalid`);
}
if (baselineMajor !== supportedMajor || baselineMinor !== supportedMinor) {
  fail(`bundled baseline ${baselineVersion} does not match CLI contract ${supportedContract}`);
}
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

let changes;
try {
  changes = apiCompare(baseline, candidate).diffs;
} catch (error) {
  fail(`OpenAPI diff failed: ${error instanceof Error ? error.message : String(error)}`);
}

const incompatible = changes.filter(({ type }) => type === "breaking" || type === "unclassified");
if (incompatible.length > 0) {
  for (const change of incompatible) {
    const path = Array.isArray(change.path) ? change.path.join(".") : "unknown path";
    console.error(`${change.type.toUpperCase()}: ${path}: ${change.description ?? change.action}`);
  }
  fail(`${incompatible.length} incompatible OpenAPI change${incompatible.length === 1 ? "" : "s"}`);
}

console.log(
  `API ${contractVersion} compatible with CLI contract ${supportedContract}: ${requiredOperations.length} operations checked, ${changes.length} compatible change${changes.length === 1 ? "" : "s"}`,
);
