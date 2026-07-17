import assert from "node:assert/strict";
import test from "node:test";
import { CliError } from "../src/errors.js";
import {
  validateBusinessModelElementWriteInput,
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
