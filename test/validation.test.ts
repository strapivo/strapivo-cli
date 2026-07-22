import assert from "node:assert/strict";
import test from "node:test";
import { CliError } from "../src/errors.js";
import {
  BUSINESS_MODEL_ENVIRONMENT_TOPICS,
  validateBusinessModelElementArchiveInput,
  validateBusinessModelElementRejectInput,
  validateBusinessModelElementWriteInput,
  validateBusinessModelEnvironmentFocus,
  validateBusinessModelEnvironmentItemArchiveInput,
  validateBusinessModelEnvironmentItemRejectInput,
  validateBusinessModelEnvironmentItemWriteInput,
  validateBusinessModelEnvironmentPage,
  validateBusinessModelEnvironmentView,
  validateBusinessModelEnvironmentWriteInput,
  validateBusinessModelStreamMembershipWriteInput,
  validateBusinessModelStreamWriteInput,
  validateBusinessModelWriteInput,
} from "../src/validation.js";

function rejectsInput(fn: () => unknown, message: RegExp): void {
  assert.throws(
    fn,
    (error: unknown) => error instanceof CliError && error.code === "input_invalid" && message.test(error.message),
  );
}

test("Business Model create and update require paired ID and lock version", () => {
  const create = validateBusinessModelWriteInput({
    business_model_id: null,
    lock_version: null,
    name: "Acme",
    url: null,
    context_notes: null,
  });
  assert.equal(create.business_model_id, null);

  rejectsInput(
    () =>
      validateBusinessModelWriteInput({
        business_model_id: "model-id",
        lock_version: null,
        name: "Acme",
        url: null,
        context_notes: null,
      }),
    /lock_version is required/,
  );
});

test("Business Model write rejects sparse and unknown payloads", () => {
  rejectsInput(
    () =>
      validateBusinessModelWriteInput({
        business_model_id: null,
        lock_version: null,
        name: "Acme",
        url: null,
      }),
    /missing required fields/,
  );

  rejectsInput(
    () =>
      validateBusinessModelWriteInput({
        business_model_id: null,
        lock_version: null,
        name: "Acme",
        url: null,
        context_notes: null,
        status: "accepted",
      }),
    /unsupported fields/,
  );
});

test("Business Model Element child creation validates block-specific child type", () => {
  const input = validateBusinessModelElementWriteInput({
    business_model_id: "model-id",
    block: "customer_segments",
    element_id: null,
    parent_id: "parent-id",
    child_type: "job",
    lock_version: null,
    title: "Afternoon energy",
    details: "Customer job",
  });
  assert.equal(input.child_type, "job");

  rejectsInput(
    () =>
      validateBusinessModelElementWriteInput({
        business_model_id: "model-id",
        block: "channels",
        element_id: null,
        parent_id: "parent-id",
        child_type: "job",
        lock_version: null,
        title: "Wrong child",
        details: "",
      }),
    /not supported for block/,
  );
});

test("Business Model Element updates reject parent and child type", () => {
  rejectsInput(
    () =>
      validateBusinessModelElementWriteInput({
        business_model_id: "model-id",
        block: "customer_segments",
        element_id: "element-id",
        parent_id: "parent-id",
        child_type: "job",
        lock_version: 3,
        title: "Updated",
        details: "Complete details",
      }),
    /must be null or omitted when updating/,
  );
});

test("Business Model Element archive requires complete lifecycle input", () => {
  const input = validateBusinessModelElementArchiveInput({
    business_model_id: "model-id",
    element_id: "element-id",
    lock_version: 3,
    archive_reason: null,
  });
  assert.equal(input.archive_reason, null);

  rejectsInput(
    () =>
      validateBusinessModelElementArchiveInput({
        business_model_id: "model-id",
        element_id: "element-id",
        lock_version: 3,
      }),
    /missing required fields/,
  );

  rejectsInput(
    () =>
      validateBusinessModelElementArchiveInput({
        business_model_id: "model-id",
        element_id: "element-id",
        lock_version: -1,
        archive_reason: "Superseded",
      }),
    /non-negative integer/,
  );
});

test("Business Model Element rejection accepts only identifiers and lock version", () => {
  const input = validateBusinessModelElementRejectInput({
    business_model_id: "model-id",
    element_id: "element-id",
    lock_version: 2,
  });
  assert.equal(input.lock_version, 2);

  rejectsInput(
    () =>
      validateBusinessModelElementRejectInput({
        business_model_id: "model-id",
        element_id: "element-id",
        lock_version: 2,
        reason: "No longer relevant",
      }),
    /unsupported fields/,
  );
});

test("Business Model Environment scope write requires complete nullable fields", () => {
  const input = validateBusinessModelEnvironmentWriteInput({
    business_model_id: "model-id",
    lock_version: 2,
    geography: null,
    primary_market: "Premium coffee",
  });
  assert.equal(input.geography, null);

  rejectsInput(
    () =>
      validateBusinessModelEnvironmentWriteInput({
        business_model_id: "model-id",
        lock_version: 2,
        geography: "Italy",
      }),
    /missing required fields/,
  );
  rejectsInput(
    () =>
      validateBusinessModelEnvironmentWriteInput({
        business_model_id: "model-id",
        lock_version: 2,
        geography: "x".repeat(301),
        primary_market: null,
      }),
    /at most 300 characters/,
  );
});

test("Business Model Environment focused read options validate taxonomy and page bounds", () => {
  assert.equal(validateBusinessModelEnvironmentFocus("industry_forces"), "industry_forces");
  assert.equal(validateBusinessModelEnvironmentFocus("competitors"), "competitors");
  assert.equal(validateBusinessModelEnvironmentView("all"), "all");
  assert.equal(validateBusinessModelEnvironmentPage("10000"), 10_000);

  rejectsInput(() => validateBusinessModelEnvironmentFocus("unknown"), /topic, force, or 'all'/);
  rejectsInput(() => validateBusinessModelEnvironmentView("proposals"), /foundation.*all/);
  rejectsInput(() => validateBusinessModelEnvironmentPage("1.5"), /between 1 and 10000/);
  rejectsInput(() => validateBusinessModelEnvironmentPage("10001"), /between 1 and 10000/);
});

test("Business Model Environment Item writes match the complete internal tool payload", () => {
  for (const topic of BUSINESS_MODEL_ENVIRONMENT_TOPICS) {
    const input = validateBusinessModelEnvironmentItemWriteInput({
      business_model_id: "model-id",
      environment_item_id: null,
      lock_version: null,
      topic,
      title: "Relevant change",
      details: "Why this matters to the Business Model.",
      sources: [{ title: "Primary source", url: "https://example.com/source" }],
    });
    assert.equal(input.topic, topic);
  }

  const update = validateBusinessModelEnvironmentItemWriteInput({
    business_model_id: "model-id",
    environment_item_id: "item-id",
    lock_version: 3,
    topic: "competitors",
    title: "Competitor update",
    details: "Updated complete details.",
    sources: [
      { title: "First source", url: "https://example.com/one" },
      { title: "Second source", url: "https://example.com/two" },
    ],
  });
  assert.equal(update.lock_version, 3);

  rejectsInput(
    () => validateBusinessModelEnvironmentItemWriteInput({ ...update, lock_version: null }),
    /lock_version is required/,
  );
  rejectsInput(
    () => validateBusinessModelEnvironmentItemWriteInput({ ...update, topic: "industry_forces" }),
    /supported Business Model Environment topic/,
  );
  rejectsInput(
    () => validateBusinessModelEnvironmentItemWriteInput({ ...update, sources: [] }),
    /between 1 and 3/,
  );
  rejectsInput(
    () =>
      validateBusinessModelEnvironmentItemWriteInput({
        ...update,
        sources: [{ title: "Source", url: "https://example.com", note: "unsupported" }],
      }),
    /unsupported fields/,
  );
});

test("Business Model Environment Item lifecycle inputs are strict and versioned", () => {
  const archive = validateBusinessModelEnvironmentItemArchiveInput({
    business_model_id: "model-id",
    environment_item_id: "item-id",
    lock_version: 3,
    archive_reason: null,
  });
  assert.equal(archive.archive_reason, null);

  const reject = validateBusinessModelEnvironmentItemRejectInput({
    business_model_id: "model-id",
    environment_item_id: "item-id",
    lock_version: 2,
  });
  assert.equal(reject.lock_version, 2);

  rejectsInput(
    () =>
      validateBusinessModelEnvironmentItemArchiveInput({
        business_model_id: "model-id",
        environment_item_id: "item-id",
        lock_version: 3,
      }),
    /missing required fields/,
  );
  rejectsInput(
    () => validateBusinessModelEnvironmentItemRejectInput({ ...reject, reason: "Duplicate" }),
    /unsupported fields/,
  );
});

test("Business Model Stream write validates complete create and update inputs", () => {
  const create = validateBusinessModelStreamWriteInput({
    business_model_id: "model-id",
    stream_id: null,
    lock_version: null,
    name: "Hospitality capsules",
    details: null,
    color: "rose",
    position: 2,
  });
  assert.equal(create.stream_id, null);
  assert.equal(create.color, "rose");

  const update = validateBusinessModelStreamWriteInput({
    business_model_id: "model-id",
    stream_id: "stream-id",
    lock_version: 3,
    name: "Premium hospitality capsules",
    details: "Selected premium hotels",
    color: "purple",
    position: -1,
  });
  assert.equal(update.lock_version, 3);
  assert.equal(update.position, -1);

  rejectsInput(
    () => validateBusinessModelStreamWriteInput({ ...create, stream_id: "stream-id" }),
    /lock_version is required/,
  );
  rejectsInput(
    () => validateBusinessModelStreamWriteInput({ ...create, color: "magenta" }),
    /supported Business Model Stream color/,
  );
  rejectsInput(
    () => validateBusinessModelStreamWriteInput({ ...create, position: 1.5 }),
    /position must be an integer/,
  );
});

test("Business Model Stream membership write matches the internal tool payload", () => {
  const input = validateBusinessModelStreamMembershipWriteInput({
    business_model_id: "model-id",
    stream_id: "stream-id",
    stream_lock_version: 4,
    element_id: "element-id",
    operation: "add",
  });
  assert.equal(input.operation, "add");
  assert.equal(input.stream_lock_version, 4);

  rejectsInput(
    () => validateBusinessModelStreamMembershipWriteInput({ ...input, operation: "replace" }),
    /operation must be 'add' or 'remove'/,
  );
  rejectsInput(
    () => validateBusinessModelStreamMembershipWriteInput({ ...input, stream_lock_version: -1 }),
    /non-negative integer/,
  );
});
