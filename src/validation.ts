import { CliError, ExitCode } from "./errors.js";

export const BUSINESS_MODEL_BLOCKS = [
  "customer_segments",
  "value_propositions",
  "channels",
  "customer_relationships",
  "revenue_streams",
  "key_resources",
  "key_activities",
  "key_partners",
  "cost_structure",
] as const;

export type BusinessModelBlock = (typeof BUSINESS_MODEL_BLOCKS)[number];

export const CHILD_TYPES_BY_BLOCK = {
  customer_segments: ["job", "pain", "gain"],
  value_propositions: ["product_service", "pain_reliever", "gain_creator"],
} as const;

export interface BusinessModelWriteInput {
  business_model_id: string | null;
  lock_version: number | null;
  name: string;
  url: string | null;
  context_notes: string | null;
}

export interface BusinessModelElementWriteInput {
  business_model_id: string;
  block: BusinessModelBlock;
  element_id: string | null;
  parent_id: string | null;
  child_type: string | null;
  lock_version: number | null;
  title: string;
  details: string;
}

export interface BusinessModelElementArchiveInput {
  business_model_id: string;
  element_id: string;
  lock_version: number;
  archive_reason: string | null;
}

export interface BusinessModelElementRejectInput {
  business_model_id: string;
  element_id: string;
  lock_version: number;
}

export function validateBusinessModelWriteInput(value: Record<string, unknown>): BusinessModelWriteInput {
  assertOnlyKeys(value, ["business_model_id", "lock_version", "name", "url", "context_notes"]);
  assertKeysPresent(value, ["business_model_id", "lock_version", "name", "url", "context_notes"]);

  const businessModelId = nullableIdentifier(value.business_model_id, "business_model_id");
  const lockVersion = nullableLockVersion(value.lock_version);
  const name = requiredString(value.name, "name", { allowEmpty: false });
  const url = nullableString(value.url, "url");
  const contextNotes = nullableString(value.context_notes, "context_notes");

  if ((businessModelId === null) !== (lockVersion === null)) {
    throw inputError(
      businessModelId === null
        ? "lock_version must be null when creating a Business Model"
        : "lock_version is required when updating a Business Model",
    );
  }

  return {
    business_model_id: businessModelId,
    lock_version: lockVersion,
    name,
    url,
    context_notes: contextNotes,
  };
}

export function validateBusinessModelElementWriteInput(
  value: Record<string, unknown>,
): BusinessModelElementWriteInput {
  assertOnlyKeys(value, [
    "business_model_id",
    "block",
    "element_id",
    "parent_id",
    "child_type",
    "lock_version",
    "title",
    "details",
  ]);
  assertKeysPresent(value, ["business_model_id", "block", "element_id", "lock_version", "title", "details"]);

  const businessModelId = identifier(value.business_model_id, "business_model_id");
  const block = businessModelBlock(value.block);
  const elementId = nullableIdentifier(value.element_id, "element_id");
  const parentId = value.parent_id === undefined ? null : nullableIdentifier(value.parent_id, "parent_id");
  const childType = value.child_type === undefined ? null : nullableIdentifier(value.child_type, "child_type");
  const lockVersion = nullableLockVersion(value.lock_version);
  const title = requiredString(value.title, "title", { allowEmpty: false });
  const details = requiredString(value.details, "details", { allowEmpty: true });

  if ((elementId === null) !== (lockVersion === null)) {
    throw inputError(
      elementId === null
        ? "lock_version must be null when creating a Business Model Element"
        : "lock_version is required when updating a Business Model Element",
    );
  }

  if (elementId !== null) {
    if (parentId !== null || childType !== null) {
      throw inputError("parent_id and child_type must be null or omitted when updating a Business Model Element");
    }
  } else {
    if ((parentId === null) !== (childType === null)) {
      throw inputError("parent_id and child_type must both be provided when creating a child Business Model Element");
    }

    if (childType !== null) {
      const supported = childTypesForBlock(block);
      if (!supported.includes(childType)) {
        throw inputError(`child_type '${childType}' is not supported for block '${block}'`, {
          supported_child_types: supported,
        });
      }
    }
  }

  return {
    business_model_id: businessModelId,
    block,
    element_id: elementId,
    parent_id: parentId,
    child_type: childType,
    lock_version: lockVersion,
    title,
    details,
  };
}

export function validateBusinessModelElementArchiveInput(
  value: Record<string, unknown>,
): BusinessModelElementArchiveInput {
  assertOnlyKeys(value, ["business_model_id", "element_id", "lock_version", "archive_reason"]);
  assertKeysPresent(value, ["business_model_id", "element_id", "lock_version", "archive_reason"]);

  return {
    business_model_id: identifier(value.business_model_id, "business_model_id"),
    element_id: identifier(value.element_id, "element_id"),
    lock_version: lockVersion(value.lock_version),
    archive_reason: nullableString(value.archive_reason, "archive_reason"),
  };
}

export function validateBusinessModelElementRejectInput(
  value: Record<string, unknown>,
): BusinessModelElementRejectInput {
  assertOnlyKeys(value, ["business_model_id", "element_id", "lock_version"]);
  assertKeysPresent(value, ["business_model_id", "element_id", "lock_version"]);

  return {
    business_model_id: identifier(value.business_model_id, "business_model_id"),
    element_id: identifier(value.element_id, "element_id"),
    lock_version: lockVersion(value.lock_version),
  };
}

export function identifier(value: unknown, field: string): string {
  return requiredString(value, field, { allowEmpty: false });
}

function nullableIdentifier(value: unknown, field: string): string | null {
  return value === null ? null : identifier(value, field);
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requiredString(value, field, { allowEmpty: true });
}

function nullableLockVersion(value: unknown): number | null {
  if (value === null) return null;
  return lockVersion(value);
}

function lockVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw inputError("lock_version must be a non-negative integer");
  }
  return value;
}

function businessModelBlock(value: unknown): BusinessModelBlock {
  if (typeof value !== "string" || !BUSINESS_MODEL_BLOCKS.includes(value as BusinessModelBlock)) {
    throw inputError("block must be a supported Business Model Canvas block", {
      supported_blocks: BUSINESS_MODEL_BLOCKS,
    });
  }
  return value as BusinessModelBlock;
}

function childTypesForBlock(block: BusinessModelBlock): readonly string[] {
  if (block === "customer_segments") return CHILD_TYPES_BY_BLOCK.customer_segments;
  if (block === "value_propositions") return CHILD_TYPES_BY_BLOCK.value_propositions;
  return [];
}

function requiredString(value: unknown, field: string, options: { allowEmpty: boolean }): string {
  if (typeof value !== "string" || (!options.allowEmpty && value.trim() === "")) {
    throw inputError(`${field} must be ${options.allowEmpty ? "a string" : "a non-empty string"}`);
  }
  return value;
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: string[]): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unknown.length > 0) {
    throw inputError("Input contains unsupported fields", { fields: unknown });
  }
}

function assertKeysPresent(value: Record<string, unknown>, required: string[]): void {
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  if (missing.length > 0) {
    throw inputError("Input is missing required fields", { fields: missing });
  }
}

function inputError(message: string, details?: Record<string, unknown>): CliError {
  return new CliError("input_invalid", message, ExitCode.validation, details === undefined ? {} : { details });
}
