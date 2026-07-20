import assert from "node:assert/strict";
import test from "node:test";
import { CliError } from "../src/errors.js";
import {
  validateBusinessModelElementArchiveInput,
  validateBusinessModelElementRejectInput,
  validateBusinessModelElementWriteInput,
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
