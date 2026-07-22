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

export const BUSINESS_MODEL_STREAM_COLORS = [
  "yellow",
  "blue",
  "red",
  "green",
  "rose",
  "purple",
  "orange",
  "cyan",
  "indigo",
] as const;

export type BusinessModelStreamColor = (typeof BUSINESS_MODEL_STREAM_COLORS)[number];

export const BUSINESS_MODEL_STREAM_MEMBERSHIP_OPERATIONS = ["add", "remove"] as const;

export type BusinessModelStreamMembershipOperation =
  (typeof BUSINESS_MODEL_STREAM_MEMBERSHIP_OPERATIONS)[number];

export const BUSINESS_MODEL_ENVIRONMENT_FORCES = [
  "market_forces",
  "macro_economic_forces",
  "industry_forces",
  "key_trends",
] as const;

export const BUSINESS_MODEL_ENVIRONMENT_TOPICS = [
  "market_issues",
  "market_segments",
  "needs_demands",
  "switching_costs",
  "revenue_attractiveness",
  "global_market_conditions",
  "capital_markets",
  "commodities_other_resources",
  "economic_infrastructure",
  "competitors",
  "new_entrants",
  "substitute_products_services",
  "stakeholders",
  "suppliers_value_chain_actors",
  "technology_trends",
  "regulatory_trends",
  "societal_cultural_trends",
  "socioeconomic_trends",
] as const;

export const BUSINESS_MODEL_ENVIRONMENT_FOCUSES = [
  "all",
  ...BUSINESS_MODEL_ENVIRONMENT_FORCES,
  ...BUSINESS_MODEL_ENVIRONMENT_TOPICS,
] as const;

export const BUSINESS_MODEL_ENVIRONMENT_VIEWS = ["foundation", "all"] as const;
export const BUSINESS_MODEL_ENVIRONMENT_MAX_PAGE = 10_000;

export type BusinessModelEnvironmentFocus = (typeof BUSINESS_MODEL_ENVIRONMENT_FOCUSES)[number];
export type BusinessModelEnvironmentTopic = (typeof BUSINESS_MODEL_ENVIRONMENT_TOPICS)[number];
export type BusinessModelEnvironmentView = (typeof BUSINESS_MODEL_ENVIRONMENT_VIEWS)[number];

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

export interface BusinessModelStreamWriteInput {
  business_model_id: string;
  stream_id: string | null;
  lock_version: number | null;
  name: string;
  details: string | null;
  color: BusinessModelStreamColor;
  position: number;
}

export interface BusinessModelStreamMembershipWriteInput {
  business_model_id: string;
  stream_id: string;
  stream_lock_version: number;
  element_id: string;
  operation: BusinessModelStreamMembershipOperation;
}

export interface BusinessModelEnvironmentListOptions {
  focus: BusinessModelEnvironmentFocus;
  view: BusinessModelEnvironmentView;
  page: number;
}

export interface BusinessModelEnvironmentWriteInput {
  business_model_id: string;
  lock_version: number;
  geography: string | null;
  primary_market: string | null;
}

export interface BusinessModelEnvironmentItemSourceInput {
  title: string;
  url: string;
}

export interface BusinessModelEnvironmentItemWriteInput {
  business_model_id: string;
  environment_item_id: string | null;
  lock_version: number | null;
  topic: BusinessModelEnvironmentTopic;
  title: string;
  details: string;
  sources: BusinessModelEnvironmentItemSourceInput[];
}

export interface BusinessModelEnvironmentItemArchiveInput {
  business_model_id: string;
  environment_item_id: string;
  lock_version: number;
  archive_reason: string | null;
}

export interface BusinessModelEnvironmentItemRejectInput {
  business_model_id: string;
  environment_item_id: string;
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

export function validateBusinessModelStreamWriteInput(
  value: Record<string, unknown>,
): BusinessModelStreamWriteInput {
  assertOnlyKeys(value, [
    "business_model_id",
    "stream_id",
    "lock_version",
    "name",
    "details",
    "color",
    "position",
  ]);
  assertKeysPresent(value, [
    "business_model_id",
    "stream_id",
    "lock_version",
    "name",
    "details",
    "color",
    "position",
  ]);

  const streamId = nullableIdentifier(value.stream_id, "stream_id");
  const lockVersion = nullableLockVersion(value.lock_version);
  if ((streamId === null) !== (lockVersion === null)) {
    throw inputError(
      streamId === null
        ? "lock_version must be null when creating a Business Model Stream"
        : "lock_version is required when updating a Business Model Stream",
    );
  }

  return {
    business_model_id: identifier(value.business_model_id, "business_model_id"),
    stream_id: streamId,
    lock_version: lockVersion,
    name: requiredString(value.name, "name", { allowEmpty: false }),
    details: nullableString(value.details, "details"),
    color: businessModelStreamColor(value.color),
    position: integer(value.position, "position"),
  };
}

export function validateBusinessModelStreamMembershipWriteInput(
  value: Record<string, unknown>,
): BusinessModelStreamMembershipWriteInput {
  assertOnlyKeys(value, [
    "business_model_id",
    "stream_id",
    "stream_lock_version",
    "element_id",
    "operation",
  ]);
  assertKeysPresent(value, [
    "business_model_id",
    "stream_id",
    "stream_lock_version",
    "element_id",
    "operation",
  ]);

  return {
    business_model_id: identifier(value.business_model_id, "business_model_id"),
    stream_id: identifier(value.stream_id, "stream_id"),
    stream_lock_version: lockVersion(value.stream_lock_version),
    element_id: identifier(value.element_id, "element_id"),
    operation: businessModelStreamMembershipOperation(value.operation),
  };
}

export function validateBusinessModelEnvironmentWriteInput(
  value: Record<string, unknown>,
): BusinessModelEnvironmentWriteInput {
  assertOnlyKeys(value, ["business_model_id", "lock_version", "geography", "primary_market"]);
  assertKeysPresent(value, ["business_model_id", "lock_version", "geography", "primary_market"]);

  return {
    business_model_id: identifier(value.business_model_id, "business_model_id"),
    lock_version: lockVersion(value.lock_version),
    geography: nullableBoundedString(value.geography, "geography", 300),
    primary_market: nullableBoundedString(value.primary_market, "primary_market", 300),
  };
}

export function validateBusinessModelEnvironmentItemWriteInput(
  value: Record<string, unknown>,
): BusinessModelEnvironmentItemWriteInput {
  assertOnlyKeys(value, [
    "business_model_id",
    "environment_item_id",
    "lock_version",
    "topic",
    "title",
    "details",
    "sources",
  ]);
  assertKeysPresent(value, [
    "business_model_id",
    "environment_item_id",
    "lock_version",
    "topic",
    "title",
    "details",
    "sources",
  ]);

  const environmentItemId = nullableIdentifier(value.environment_item_id, "environment_item_id");
  const itemLockVersion = nullableLockVersion(value.lock_version);
  if ((environmentItemId === null) !== (itemLockVersion === null)) {
    throw inputError(
      environmentItemId === null
        ? "lock_version must be null when creating a Business Model Environment Item"
        : "lock_version is required when updating a Business Model Environment Item",
    );
  }

  return {
    business_model_id: identifier(value.business_model_id, "business_model_id"),
    environment_item_id: environmentItemId,
    lock_version: itemLockVersion,
    topic: businessModelEnvironmentTopic(value.topic),
    title: requiredString(value.title, "title", { allowEmpty: false }),
    details: requiredString(value.details, "details", { allowEmpty: false }),
    sources: businessModelEnvironmentItemSources(value.sources),
  };
}

export function validateBusinessModelEnvironmentItemArchiveInput(
  value: Record<string, unknown>,
): BusinessModelEnvironmentItemArchiveInput {
  assertOnlyKeys(value, ["business_model_id", "environment_item_id", "lock_version", "archive_reason"]);
  assertKeysPresent(value, ["business_model_id", "environment_item_id", "lock_version", "archive_reason"]);

  return {
    business_model_id: identifier(value.business_model_id, "business_model_id"),
    environment_item_id: identifier(value.environment_item_id, "environment_item_id"),
    lock_version: lockVersion(value.lock_version),
    archive_reason: nullableString(value.archive_reason, "archive_reason"),
  };
}

export function validateBusinessModelEnvironmentItemRejectInput(
  value: Record<string, unknown>,
): BusinessModelEnvironmentItemRejectInput {
  assertOnlyKeys(value, ["business_model_id", "environment_item_id", "lock_version"]);
  assertKeysPresent(value, ["business_model_id", "environment_item_id", "lock_version"]);

  return {
    business_model_id: identifier(value.business_model_id, "business_model_id"),
    environment_item_id: identifier(value.environment_item_id, "environment_item_id"),
    lock_version: lockVersion(value.lock_version),
  };
}

export function validateBusinessModelEnvironmentFocus(value: unknown): BusinessModelEnvironmentFocus {
  if (
    typeof value !== "string" ||
    !BUSINESS_MODEL_ENVIRONMENT_FOCUSES.includes(value as BusinessModelEnvironmentFocus)
  ) {
    throw inputError("focus must be a Business Model Environment topic, force, or 'all'", {
      supported_focuses: BUSINESS_MODEL_ENVIRONMENT_FOCUSES,
    });
  }
  return value as BusinessModelEnvironmentFocus;
}

export function validateBusinessModelEnvironmentView(value: unknown): BusinessModelEnvironmentView {
  if (
    typeof value !== "string" ||
    !BUSINESS_MODEL_ENVIRONMENT_VIEWS.includes(value as BusinessModelEnvironmentView)
  ) {
    throw inputError("view must be 'foundation' or 'all'", {
      supported_views: BUSINESS_MODEL_ENVIRONMENT_VIEWS,
    });
  }
  return value as BusinessModelEnvironmentView;
}

export function validateBusinessModelEnvironmentPage(value: unknown): number {
  const page = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isInteger(page) || (page as number) < 1 || (page as number) > BUSINESS_MODEL_ENVIRONMENT_MAX_PAGE) {
    throw inputError(`page must be an integer between 1 and ${BUSINESS_MODEL_ENVIRONMENT_MAX_PAGE}`);
  }
  return page as number;
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

function nullableBoundedString(value: unknown, field: string, maximumLength: number): string | null {
  const string = nullableString(value, field);
  if (string !== null && [...string].length > maximumLength) {
    throw inputError(`${field} must contain at most ${maximumLength} characters`);
  }
  return string;
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

function integer(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw inputError(`${field} must be an integer`);
  }
  return value;
}

function businessModelEnvironmentTopic(value: unknown): BusinessModelEnvironmentTopic {
  if (
    typeof value !== "string" ||
    !BUSINESS_MODEL_ENVIRONMENT_TOPICS.includes(value as BusinessModelEnvironmentTopic)
  ) {
    throw inputError("topic must be a supported Business Model Environment topic", {
      supported_topics: BUSINESS_MODEL_ENVIRONMENT_TOPICS,
    });
  }
  return value as BusinessModelEnvironmentTopic;
}

function businessModelEnvironmentItemSources(value: unknown): BusinessModelEnvironmentItemSourceInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) {
    throw inputError("sources must contain between 1 and 3 source objects");
  }

  return value.map((source, index) => {
    if (!isRecord(source) || Array.isArray(source)) {
      throw inputError(`sources[${index}] must be an object`);
    }
    assertOnlyKeys(source, ["title", "url"]);
    assertKeysPresent(source, ["title", "url"]);
    return {
      title: requiredString(source.title, `sources[${index}].title`, { allowEmpty: false }),
      url: requiredString(source.url, `sources[${index}].url`, { allowEmpty: false }),
    };
  });
}

function businessModelStreamColor(value: unknown): BusinessModelStreamColor {
  if (
    typeof value !== "string" ||
    !BUSINESS_MODEL_STREAM_COLORS.includes(value as BusinessModelStreamColor)
  ) {
    throw inputError("color must be a supported Business Model Stream color", {
      supported_colors: BUSINESS_MODEL_STREAM_COLORS,
    });
  }
  return value as BusinessModelStreamColor;
}

function businessModelStreamMembershipOperation(
  value: unknown,
): BusinessModelStreamMembershipOperation {
  if (
    typeof value !== "string" ||
    !BUSINESS_MODEL_STREAM_MEMBERSHIP_OPERATIONS.includes(
      value as BusinessModelStreamMembershipOperation,
    )
  ) {
    throw inputError("operation must be 'add' or 'remove'", {
      supported_operations: BUSINESS_MODEL_STREAM_MEMBERSHIP_OPERATIONS,
    });
  }
  return value as BusinessModelStreamMembershipOperation;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
