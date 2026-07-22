import assert from "node:assert/strict";
import test from "node:test";
import { ApiClient } from "../src/api.js";
import { CliError, ExitCode } from "../src/errors.js";

interface CapturedRequest {
  url: string;
  method: string;
  headers: Headers;
  body: string | null;
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function clientWith(
  handler: (request: CapturedRequest) => Response | Promise<Response>,
): { client: ApiClient; requests: CapturedRequest[] } {
  const requests: CapturedRequest[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const request: CapturedRequest = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : null,
    };
    requests.push(request);
    return handler(request);
  }) as typeof globalThis.fetch;

  return {
    client: new ApiClient({
      baseUrl: "https://strapivo.example/",
      apiToken: "secret-token",
      fetchImpl,
      userAgent: "test-client",
    }),
    requests,
  };
}

const workspace = {
  id: "workspace-id",
  name: "Acme",
  slug: "acme",
  path: "/acme",
  role: "owner",
  business_models_url: "https://strapivo.example/acme/business_models.json",
};

const streamDocument = {
  id: "stream-id",
  name: "Hospitality capsules",
  details: "Capsules served through premium hotels.",
  color: "rose" as const,
  position: 2,
  lock_version: 1,
  members: [],
};

test("Workspace listing sends bearer auth and JSON accept header", async () => {
  const { client, requests } = clientWith(() => jsonResponse([workspace]));

  assert.deepEqual(await client.listWorkspaces(), [workspace]);
  assert.equal(requests[0]?.url, "https://strapivo.example/workspaces.json");
  assert.equal(requests[0]?.headers.get("authorization"), "Bearer secret-token");
  assert.equal(requests[0]?.headers.get("accept"), "application/json");
  assert.equal(requests[0]?.headers.get("user-agent"), "test-client");
});

test("Business Model read preserves streams from the complete document", async () => {
  const businessModel = {
    id: "model-id",
    name: "Acme Italy",
    url: null,
    context_notes: null,
    lock_version: 3,
    environment: { geography: "Italy", primary_market: "Enterprise software" },
    blocks: {},
    streams: [
      {
        id: "01900000-0000-7000-8000-000000000002",
        name: "Enterprise motion",
        details: "Strategic elements for enterprise growth",
        color: "blue",
        position: 1,
        lock_version: 2,
        members: [
          {
            element_id: "element-id",
            block: "customer_segments",
            title: "Enterprise buyers",
            status: "accepted",
          },
        ],
      },
    ],
  };
  const { client } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return jsonResponse(businessModel);
  });

  assert.deepEqual(await client.readBusinessModel("acme", "model-id"), businessModel);
});

test("Business Model write resolves Workspace link and emits tool-shaped result", async () => {
  const { client, requests } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return jsonResponse(
      {
        id: "model-id",
        name: "Acme Italy",
        url: "https://example.com",
        context_notes: "Context",
        lock_version: 0,
        blocks: {},
        streams: [],
      },
      201,
    );
  });

  const result = await client.writeBusinessModel("acme", {
    business_model_id: null,
    lock_version: null,
    name: "Acme Italy",
    url: "https://example.com",
    context_notes: "Context",
  });

  assert.deepEqual(result, {
    operation: "created",
    id: "model-id",
    name: "Acme Italy",
    url: "https://example.com",
    context_notes: "Context",
    lock_version: 0,
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[1]?.url, workspace.business_models_url);
  assert.equal(requests[1]?.method, "POST");
  assert.deepEqual(JSON.parse(requests[1]?.body ?? ""), {
    name: "Acme Italy",
    url: "https://example.com",
    context_notes: "Context",
  });
});

test("Business Model Stream create omits lock version and returns a tool-shaped result", async () => {
  const { client, requests } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return jsonResponse({ ...streamDocument, lock_version: 0 }, 201);
  });

  const result = await client.writeBusinessModelStream("acme", {
    business_model_id: "model/id",
    stream_id: null,
    lock_version: null,
    name: streamDocument.name,
    details: streamDocument.details,
    color: streamDocument.color,
    position: streamDocument.position,
  });

  assert.deepEqual(result, { operation: "created", ...streamDocument, lock_version: 0 });
  assert.equal(requests[1]?.url, "https://strapivo.example/acme/business_models/model%2Fid/streams.json");
  assert.equal(requests[1]?.method, "POST");
  assert.deepEqual(JSON.parse(requests[1]?.body ?? ""), {
    name: streamDocument.name,
    details: streamDocument.details,
    color: streamDocument.color,
    position: streamDocument.position,
  });
});

test("Business Model Stream update sends complete metadata and latest lock version", async () => {
  const { client, requests } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return jsonResponse(streamDocument);
  });

  const result = await client.writeBusinessModelStream("acme", {
    business_model_id: "model-id",
    stream_id: "stream/id",
    lock_version: 0,
    name: streamDocument.name,
    details: streamDocument.details,
    color: streamDocument.color,
    position: streamDocument.position,
  });

  assert.deepEqual(result, { operation: "updated", ...streamDocument });
  assert.equal(
    requests[1]?.url,
    "https://strapivo.example/acme/business_models/model-id/streams/stream%2Fid.json",
  );
  assert.equal(requests[1]?.method, "PATCH");
  assert.deepEqual(JSON.parse(requests[1]?.body ?? ""), {
    lock_version: 0,
    name: streamDocument.name,
    details: streamDocument.details,
    color: streamDocument.color,
    position: streamDocument.position,
  });
});

test("Business Model Stream membership add sends the Stream lock and element ID", async () => {
  const { client, requests } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return jsonResponse(streamDocument, 201);
  });

  const result = await client.writeBusinessModelStreamMembership("acme", {
    business_model_id: "model-id",
    stream_id: "stream-id",
    stream_lock_version: 0,
    element_id: "element-id",
    operation: "add",
  });

  assert.deepEqual(result, { operation: "add", ...streamDocument });
  assert.equal(
    requests[1]?.url,
    "https://strapivo.example/acme/business_models/model-id/streams/stream-id/memberships.json",
  );
  assert.equal(requests[1]?.method, "POST");
  assert.deepEqual(JSON.parse(requests[1]?.body ?? ""), {
    lock_version: 0,
    element_id: "element-id",
  });
});

test("Business Model Stream membership remove encodes the element ID and sends a DELETE body", async () => {
  const { client, requests } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return jsonResponse({ ...streamDocument, lock_version: 2 });
  });

  const result = await client.writeBusinessModelStreamMembership("acme", {
    business_model_id: "model-id",
    stream_id: "stream/id",
    stream_lock_version: 1,
    element_id: "element/id",
    operation: "remove",
  });

  assert.deepEqual(result, { operation: "remove", ...streamDocument, lock_version: 2 });
  assert.equal(
    requests[1]?.url,
    "https://strapivo.example/acme/business_models/model-id/streams/stream%2Fid/memberships/element%2Fid.json",
  );
  assert.equal(requests[1]?.method, "DELETE");
  assert.deepEqual(JSON.parse(requests[1]?.body ?? ""), { lock_version: 1 });
});

test("Business Model Element update sends only supported update fields", async () => {
  const { client, requests } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return jsonResponse({
      id: "element-id",
      title: "Updated title",
      details: "Complete details",
      status: "accepted",
      lock_version: 4,
      children: {},
    });
  });

  const result = await client.writeBusinessModelElement("acme", {
    business_model_id: "model-id",
    block: "channels",
    element_id: "element-id",
    parent_id: null,
    child_type: null,
    lock_version: 3,
    title: "Updated title",
    details: "Complete details",
  });

  assert.equal(result.operation, "updated");
  assert.equal(requests[1]?.url, "https://strapivo.example/acme/business_models/model-id/elements/element-id.json");
  assert.equal(requests[1]?.method, "PATCH");
  assert.deepEqual(JSON.parse(requests[1]?.body ?? ""), {
    block: "channels",
    lock_version: 3,
    title: "Updated title",
    details: "Complete details",
  });
});

test("Business Model Element archive sends lifecycle payload and accepts 204", async () => {
  const { client, requests } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return new Response(null, { status: 204 });
  });

  const result = await client.archiveBusinessModelElement("acme", {
    business_model_id: "model/id",
    element_id: "element/id",
    lock_version: 3,
    archive_reason: "Superseded",
  });

  assert.deepEqual(result, {
    operation: "archived",
    business_model_id: "model/id",
    element_id: "element/id",
  });
  assert.equal(
    requests[1]?.url,
    "https://strapivo.example/acme/business_models/model%2Fid/elements/element%2Fid/archival.json",
  );
  assert.equal(requests[1]?.method, "POST");
  assert.deepEqual(JSON.parse(requests[1]?.body ?? ""), {
    lock_version: 3,
    archive_reason: "Superseded",
  });
});

test("Business Model Element reject sends DELETE body and accepts 204", async () => {
  const { client, requests } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return new Response(null, { status: 204 });
  });

  const result = await client.rejectBusinessModelElement("acme", {
    business_model_id: "model-id",
    element_id: "element-id",
    lock_version: 2,
  });

  assert.deepEqual(result, {
    operation: "rejected",
    business_model_id: "model-id",
    element_id: "element-id",
  });
  assert.equal(
    requests[1]?.url,
    "https://strapivo.example/acme/business_models/model-id/elements/element-id/rejection.json",
  );
  assert.equal(requests[1]?.method, "DELETE");
  assert.deepEqual(JSON.parse(requests[1]?.body ?? ""), { lock_version: 2 });
});

test("Business Model Environment read and update use the singular nested endpoint", async () => {
  const environment = {
    business_model_id: "model/id",
    geography: "Italy",
    primary_market: null,
    lock_version: 3,
  };
  const { client, requests } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return jsonResponse(environment);
  });

  assert.deepEqual(await client.readBusinessModelEnvironment("acme", "model/id"), environment);
  const result = await client.writeBusinessModelEnvironment("acme", {
    business_model_id: "model/id",
    lock_version: 3,
    geography: "Northern Italy",
    primary_market: null,
  });

  assert.deepEqual(result, {
    operation: "updated",
    business_model_id: "model/id",
    scope: { geography: "Italy", primary_market: null, lock_version: 3 },
  });
  assert.equal(
    requests[1]?.url,
    "https://strapivo.example/acme/business_models/model%2Fid/environment.json",
  );
  assert.equal(requests[3]?.method, "PATCH");
  assert.deepEqual(JSON.parse(requests[3]?.body ?? ""), {
    lock_version: 3,
    geography: "Northern Italy",
    primary_market: null,
  });
});

test("Business Model Environment Item list sends explicit focus, view, and page", async () => {
  const collection = {
    business_model_id: "model-id",
    view: "all",
    focus: "industry_forces",
    items: [],
    pagination: { page: 2, total_pages: 3, more_items_beyond_page_limit: false },
  };
  const { client, requests } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return jsonResponse(collection);
  });

  assert.deepEqual(
    await client.listBusinessModelEnvironmentItems("acme", "model-id", {
      focus: "industry_forces",
      view: "all",
      page: 2,
    }),
    collection,
  );
  assert.equal(
    requests[1]?.url,
    "https://strapivo.example/acme/business_models/model-id/environment_items.json?focus=industry_forces&view=all&page=2",
  );
  assert.equal(requests[1]?.method, "GET");
});

test("Business Model Environment Item read preserves the complete document", async () => {
  const item = {
    id: "item/id",
    kind: "environment_item",
    topic: "regulatory_trends",
    title: "New regulation",
    details: "Complete details",
    sources: [{ title: "Regulator", url: "https://example.com/regulation" }],
    status: "archived",
    origin: "ai_drafted",
    position: 1,
    lock_version: 4,
  };
  const { client, requests } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return jsonResponse(item);
  });

  assert.deepEqual(
    await client.readBusinessModelEnvironmentItem("acme", "model/id", "item/id"),
    item,
  );
  assert.equal(
    requests[1]?.url,
    "https://strapivo.example/acme/business_models/model%2Fid/environment_items/item%2Fid.json",
  );
});

test("Business Model Environment Item create omits ID and lock version", async () => {
  const response = {
    id: "item-id",
    kind: "competitor",
    topic: "competitors",
    title: "Lavazza",
    details: "Relevant competitor",
    sources: [{ title: "Lavazza", url: "https://www.lavazza.com/en" }],
    status: "proposed",
    origin: "ai_drafted",
    position: 1,
    lock_version: 0,
  };
  const { client, requests } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return jsonResponse(response, 201);
  });

  const result = await client.writeBusinessModelEnvironmentItem("acme", {
    business_model_id: "model-id",
    environment_item_id: null,
    lock_version: null,
    topic: "competitors",
    title: "Lavazza",
    details: "Relevant competitor",
    sources: [{ title: "Lavazza", url: "https://www.lavazza.com/en" }],
  });

  assert.deepEqual(result, {
    operation: "created",
    business_model_id: "model-id",
    id: "item-id",
    kind: "competitor",
    topic: "competitors",
    status: "proposed",
    origin: "ai_drafted",
    position: 1,
    lock_version: 0,
  });
  assert.equal(
    requests[1]?.url,
    "https://strapivo.example/acme/business_models/model-id/environment_items.json",
  );
  assert.equal(requests[1]?.method, "POST");
  assert.deepEqual(JSON.parse(requests[1]?.body ?? ""), {
    topic: "competitors",
    title: "Lavazza",
    details: "Relevant competitor",
    sources: [{ title: "Lavazza", url: "https://www.lavazza.com/en" }],
  });
});

test("Business Model Environment Item update sends the complete mutable proposal", async () => {
  const response = {
    id: "item/id",
    kind: "environment_item",
    topic: "technology_trends",
    status: "proposed",
    origin: "ai_drafted",
    position: 2,
    lock_version: 4,
  };
  const { client, requests } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return jsonResponse(response);
  });

  const result = await client.writeBusinessModelEnvironmentItem("acme", {
    business_model_id: "model-id",
    environment_item_id: "item/id",
    lock_version: 3,
    topic: "technology_trends",
    title: "AI adoption",
    details: "Updated complete details",
    sources: [{ title: "Research", url: "https://example.com/research" }],
  });

  assert.equal(result.operation, "updated");
  assert.equal(
    requests[1]?.url,
    "https://strapivo.example/acme/business_models/model-id/environment_items/item%2Fid.json",
  );
  assert.equal(requests[1]?.method, "PATCH");
  assert.deepEqual(JSON.parse(requests[1]?.body ?? ""), {
    lock_version: 3,
    topic: "technology_trends",
    title: "AI adoption",
    details: "Updated complete details",
    sources: [{ title: "Research", url: "https://example.com/research" }],
  });
});

test("Business Model Environment Item lifecycle operations accept empty success", async () => {
  const { client, requests } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return new Response(null, { status: 204 });
  });

  assert.deepEqual(
    await client.archiveBusinessModelEnvironmentItem("acme", {
      business_model_id: "model/id",
      environment_item_id: "item/id",
      lock_version: 3,
      archive_reason: null,
    }),
    { operation: "archived", business_model_id: "model/id", environment_item_id: "item/id" },
  );
  assert.deepEqual(
    await client.rejectBusinessModelEnvironmentItem("acme", {
      business_model_id: "model/id",
      environment_item_id: "item/id",
      lock_version: 4,
    }),
    { operation: "rejected", business_model_id: "model/id", environment_item_id: "item/id" },
  );

  assert.equal(
    requests[1]?.url,
    "https://strapivo.example/acme/business_models/model%2Fid/environment_items/item%2Fid/archival.json",
  );
  assert.equal(requests[1]?.method, "POST");
  assert.deepEqual(JSON.parse(requests[1]?.body ?? ""), {
    lock_version: 3,
    archive_reason: null,
  });
  assert.equal(
    requests[3]?.url,
    "https://strapivo.example/acme/business_models/model%2Fid/environment_items/item%2Fid/rejection.json",
  );
  assert.equal(requests[3]?.method, "DELETE");
  assert.deepEqual(JSON.parse(requests[3]?.body ?? ""), { lock_version: 4 });
});

test("ambiguous Environment Item create failures are not marked safe to retry", async () => {
  const { client, requests } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    throw new Error("connection closed after send");
  });

  await assert.rejects(
    client.writeBusinessModelEnvironmentItem("acme", {
      business_model_id: "model-id",
      environment_item_id: null,
      lock_version: null,
      topic: "competitors",
      title: "Lavazza",
      details: "Relevant competitor",
      sources: [{ title: "Lavazza", url: "https://www.lavazza.com/en" }],
    }),
    (error: unknown) =>
      error instanceof CliError && error.code === "transport_error" && !error.retryable,
  );
  assert.equal(requests.length, 2);
});

test("API conflict preserves stable server error and conflict exit code", async () => {
  const { client } = clientWith((request) => {
    if (request.url.endsWith("/workspaces.json")) return jsonResponse([workspace]);
    return jsonResponse(
      {
        error: {
          code: "stale_object",
          message: "Business Model changed since it was read",
          retryable: true,
          details: {},
        },
      },
      409,
    );
  });

  await assert.rejects(
    client.writeBusinessModel("acme", {
      business_model_id: "model-id",
      lock_version: 2,
      name: "Acme",
      url: null,
      context_notes: null,
    }),
    (error: unknown) =>
      error instanceof CliError &&
      error.code === "stale_object" &&
      error.retryable &&
      error.exitCode === ExitCode.conflict,
  );
});

test("cross-origin Workspace links are rejected before credentials are sent", async () => {
  const hostileWorkspace = {
    ...workspace,
    business_models_url: "https://attacker.example/models.json",
  };
  const { client, requests } = clientWith(() => jsonResponse([hostileWorkspace]));

  await assert.rejects(
    client.listBusinessModels("acme"),
    (error: unknown) => error instanceof CliError && error.code === "unsafe_api_link",
  );
  assert.equal(requests.length, 1);
});

test("unexpected redirects are not followed", async () => {
  const { client, requests } = clientWith(() =>
    new Response(null, { status: 302, headers: { Location: "https://attacker.example/steal" } }),
  );

  await assert.rejects(
    client.listWorkspaces(),
    (error: unknown) => error instanceof CliError && error.code === "unsafe_redirect",
  );
  assert.equal(requests.length, 1);
});

test("response body connection failures remain retryable transport errors", async () => {
  const brokenBody = new ReadableStream({
    start(controller) {
      controller.error(new Error("connection closed"));
    },
  });
  const { client } = clientWith(() => new Response(brokenBody, { status: 200 }));

  await assert.rejects(
    client.listWorkspaces(),
    (error: unknown) =>
      error instanceof CliError &&
      error.code === "transport_error" &&
      error.retryable &&
      error.exitCode === ExitCode.transport,
  );
});
