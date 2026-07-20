import { CliError, ExitCode } from "./errors.js";
import type {
  BusinessModelElementArchiveInput,
  BusinessModelElementRejectInput,
  BusinessModelElementWriteInput,
  BusinessModelStreamMembershipWriteInput,
  BusinessModelStreamWriteInput,
  BusinessModelWriteInput,
} from "./validation.js";

interface WorkspaceDocument {
  id: string;
  name: string;
  slug: string;
  path: string;
  role: string;
  business_models_url: string;
}

interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

export class ApiClient {
  readonly baseUrl: URL;
  readonly apiToken: string;
  readonly fetchImpl: typeof globalThis.fetch;
  readonly timeoutMilliseconds: number;
  readonly userAgent: string;

  constructor(options: {
    baseUrl: string;
    apiToken: string;
    fetchImpl?: typeof globalThis.fetch;
    timeoutMilliseconds?: number;
    userAgent?: string;
  }) {
    this.baseUrl = new URL(options.baseUrl);
    this.apiToken = options.apiToken;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMilliseconds = options.timeoutMilliseconds ?? 30_000;
    this.userAgent = options.userAgent ?? "@strapivo/cli";
  }

  async listWorkspaces(): Promise<WorkspaceDocument[]> {
    const response = await this.request("GET", new URL("workspaces.json", this.baseUrl));
    if (!Array.isArray(response)) throw incompatible("Workspace list must be a JSON array");
    return response.map((item, index) => workspaceDocument(item, index));
  }

  async listBusinessModels(workspaceSlug: string): Promise<unknown[]> {
    const workspace = await this.resolveWorkspace(workspaceSlug);
    const response = await this.request("GET", this.workspaceBusinessModelsUrl(workspace));
    if (!Array.isArray(response)) throw incompatible("Business Model list must be a JSON array");
    return response;
  }

  async readBusinessModel(workspaceSlug: string, businessModelId: string): Promise<Record<string, unknown>> {
    const workspace = await this.resolveWorkspace(workspaceSlug);
    const response = await this.request("GET", memberUrl(this.workspaceBusinessModelsUrl(workspace), businessModelId));
    return responseRecord(response, "Business Model response");
  }

  async writeBusinessModel(
    workspaceSlug: string,
    input: BusinessModelWriteInput,
  ): Promise<Record<string, unknown>> {
    const workspace = await this.resolveWorkspace(workspaceSlug);
    const collectionUrl = this.workspaceBusinessModelsUrl(workspace);
    const businessModelId = input.business_model_id;
    const creating = businessModelId === null;
    const response = businessModelId === null
      ? await this.request("POST", collectionUrl, {
          name: input.name,
          url: input.url,
          context_notes: input.context_notes,
        })
      : await this.request("PATCH", memberUrl(collectionUrl, businessModelId), {
          lock_version: input.lock_version,
          name: input.name,
          url: input.url,
          context_notes: input.context_notes,
        });

    const document = responseRecord(response, "Business Model write response");
    return {
      operation: creating ? "created" : "updated",
      id: requiredResponseField(document, "id"),
      name: requiredResponseField(document, "name"),
      url: nullableResponseField(document, "url"),
      context_notes: nullableResponseField(document, "context_notes"),
      lock_version: requiredResponseField(document, "lock_version"),
    };
  }

  async readBusinessModelElement(
    workspaceSlug: string,
    businessModelId: string,
    elementId: string,
  ): Promise<Record<string, unknown>> {
    const workspace = await this.resolveWorkspace(workspaceSlug);
    const modelUrl = memberUrl(this.workspaceBusinessModelsUrl(workspace), businessModelId);
    const response = await this.request("GET", elementMemberUrl(modelUrl, elementId));
    return responseRecord(response, "Business Model Element response");
  }

  async writeBusinessModelElement(
    workspaceSlug: string,
    input: BusinessModelElementWriteInput,
  ): Promise<Record<string, unknown>> {
    const workspace = await this.resolveWorkspace(workspaceSlug);
    const modelUrl = memberUrl(this.workspaceBusinessModelsUrl(workspace), input.business_model_id);
    const elementId = input.element_id;
    const creating = elementId === null;
    const response = elementId === null
      ? await this.request("POST", elementsCollectionUrl(modelUrl), {
          block: input.block,
          parent_id: input.parent_id,
          child_type: input.child_type,
          title: input.title,
          details: input.details,
        })
      : await this.request("PATCH", elementMemberUrl(modelUrl, elementId), {
          block: input.block,
          lock_version: input.lock_version,
          title: input.title,
          details: input.details,
        });

    const document = responseRecord(response, "Business Model Element write response");
    return {
      operation: creating ? "created" : "updated",
      id: requiredResponseField(document, "id"),
      title: requiredResponseField(document, "title"),
      details: requiredResponseField(document, "details"),
      status: requiredResponseField(document, "status"),
      lock_version: requiredResponseField(document, "lock_version"),
    };
  }

  async archiveBusinessModelElement(
    workspaceSlug: string,
    input: BusinessModelElementArchiveInput,
  ): Promise<Record<string, unknown>> {
    const workspace = await this.resolveWorkspace(workspaceSlug);
    const modelUrl = memberUrl(this.workspaceBusinessModelsUrl(workspace), input.business_model_id);
    const url = elementLifecycleUrl(modelUrl, input.element_id, "archival");
    await this.request(
      "POST",
      url,
      { lock_version: input.lock_version, archive_reason: input.archive_reason },
      { allowEmptySuccess: true },
    );
    return {
      operation: "archived",
      business_model_id: input.business_model_id,
      element_id: input.element_id,
    };
  }

  async rejectBusinessModelElement(
    workspaceSlug: string,
    input: BusinessModelElementRejectInput,
  ): Promise<Record<string, unknown>> {
    const workspace = await this.resolveWorkspace(workspaceSlug);
    const modelUrl = memberUrl(this.workspaceBusinessModelsUrl(workspace), input.business_model_id);
    const url = elementLifecycleUrl(modelUrl, input.element_id, "rejection");
    await this.request("DELETE", url, { lock_version: input.lock_version }, { allowEmptySuccess: true });
    return {
      operation: "rejected",
      business_model_id: input.business_model_id,
      element_id: input.element_id,
    };
  }

  async writeBusinessModelStream(
    workspaceSlug: string,
    input: BusinessModelStreamWriteInput,
  ): Promise<Record<string, unknown>> {
    const workspace = await this.resolveWorkspace(workspaceSlug);
    const modelUrl = memberUrl(this.workspaceBusinessModelsUrl(workspace), input.business_model_id);
    const collectionUrl = streamsCollectionUrl(modelUrl);
    const streamId = input.stream_id;
    const creating = streamId === null;
    const response = streamId === null
      ? await this.request("POST", collectionUrl, {
          name: input.name,
          details: input.details,
          color: input.color,
          position: input.position,
        })
      : await this.request("PATCH", memberUrl(collectionUrl, streamId), {
          lock_version: input.lock_version,
          name: input.name,
          details: input.details,
          color: input.color,
          position: input.position,
        });

    return streamWriteResult(response, creating ? "created" : "updated");
  }

  async writeBusinessModelStreamMembership(
    workspaceSlug: string,
    input: BusinessModelStreamMembershipWriteInput,
  ): Promise<Record<string, unknown>> {
    const workspace = await this.resolveWorkspace(workspaceSlug);
    const modelUrl = memberUrl(this.workspaceBusinessModelsUrl(workspace), input.business_model_id);
    const streamUrl = memberUrl(streamsCollectionUrl(modelUrl), input.stream_id);
    const collectionUrl = streamMembershipsCollectionUrl(streamUrl);
    const response = input.operation === "add"
      ? await this.request("POST", collectionUrl, {
          lock_version: input.stream_lock_version,
          element_id: input.element_id,
        })
      : await this.request("DELETE", memberUrl(collectionUrl, input.element_id), {
          lock_version: input.stream_lock_version,
        });

    return streamWriteResult(response, input.operation);
  }

  private async resolveWorkspace(slug: string): Promise<WorkspaceDocument> {
    const workspaces = await this.listWorkspaces();
    const workspace = workspaces.find((candidate) => candidate.slug === slug);
    if (workspace === undefined) {
      throw new CliError("not_found", `Workspace '${slug}' was not found`, ExitCode.notFound);
    }
    return workspace;
  }

  private workspaceBusinessModelsUrl(workspace: WorkspaceDocument): URL {
    let url: URL;
    try {
      url = new URL(workspace.business_models_url, this.baseUrl);
    } catch (error) {
      throw incompatible("Workspace business_models_url is invalid", { cause: error });
    }
    this.assertSameOrigin(url);
    return url;
  }

  private assertSameOrigin(url: URL): void {
    if (url.origin !== this.baseUrl.origin) {
      throw new CliError(
        "unsafe_api_link",
        "Strapivo returned a link on another origin; bearer credentials were not sent",
        ExitCode.incompatibleResponse,
        { details: { origin: url.origin } },
      );
    }
  }

  private async request(
    method: string,
    url: URL,
    body?: Record<string, unknown>,
    options: { allowEmptySuccess?: boolean } = {},
  ): Promise<unknown> {
    this.assertSameOrigin(url);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${this.apiToken}`,
      "User-Agent": this.userAgent,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      const request: RequestInit = {
        method,
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(this.timeoutMilliseconds),
      };
      if (body !== undefined) request.body = JSON.stringify(body);
      response = await this.fetchImpl(url, request);
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new CliError(
        timedOut ? "request_timeout" : "transport_error",
        timedOut ? `Request timed out after ${this.timeoutMilliseconds}ms` : "Could not reach Strapivo",
        ExitCode.transport,
        { retryable: true, cause: error },
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location !== null) {
        const redirectUrl = new URL(location, url);
        if (redirectUrl.origin !== this.baseUrl.origin) {
          throw new CliError(
            "unsafe_redirect",
            "Strapivo redirected to another origin; bearer credentials were not sent",
            ExitCode.transport,
            { details: { origin: redirectUrl.origin } },
          );
        }
      }
      throw new CliError(
        "unexpected_redirect",
        "Strapivo returned an unexpected redirect",
        ExitCode.transport,
        { details: { status: response.status } },
      );
    }

    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new CliError(
        timedOut ? "request_timeout" : "transport_error",
        timedOut ? `Request timed out after ${this.timeoutMilliseconds}ms` : "Connection failed while reading Strapivo response",
        ExitCode.transport,
        { retryable: true, cause: error },
      );
    }
    const parsed = parseResponseBody(text, response.ok, options.allowEmptySuccess === true);

    if (!response.ok) throw apiError(response.status, parsed);
    return parsed;
  }
}

function workspaceDocument(value: unknown, index: number): WorkspaceDocument {
  const document = responseRecord(value, `Workspace response at index ${index}`);
  return {
    id: responseString(document, "id"),
    name: responseString(document, "name"),
    slug: responseString(document, "slug"),
    path: responseString(document, "path"),
    role: responseString(document, "role"),
    business_models_url: responseString(document, "business_models_url"),
  };
}

function memberUrl(collectionUrl: URL, id: string): URL {
  const url = new URL(collectionUrl);
  const collectionPath = url.pathname.endsWith(".json") ? url.pathname.slice(0, -5) : url.pathname.replace(/\/$/, "");
  url.pathname = `${collectionPath}/${encodeURIComponent(id)}.json`;
  url.search = "";
  url.hash = "";
  return url;
}

function elementsCollectionUrl(businessModelUrl: URL): URL {
  const url = new URL(businessModelUrl);
  const modelPath = url.pathname.endsWith(".json") ? url.pathname.slice(0, -5) : url.pathname.replace(/\/$/, "");
  url.pathname = `${modelPath}/elements.json`;
  url.search = "";
  url.hash = "";
  return url;
}

function elementMemberUrl(businessModelUrl: URL, elementId: string): URL {
  return memberUrl(elementsCollectionUrl(businessModelUrl), elementId);
}

function streamsCollectionUrl(businessModelUrl: URL): URL {
  return nestedCollectionUrl(businessModelUrl, "streams");
}

function streamMembershipsCollectionUrl(streamUrl: URL): URL {
  return nestedCollectionUrl(streamUrl, "memberships");
}

function nestedCollectionUrl(parentUrl: URL, collection: string): URL {
  const url = new URL(parentUrl);
  const parentPath = url.pathname.endsWith(".json") ? url.pathname.slice(0, -5) : url.pathname.replace(/\/$/, "");
  url.pathname = `${parentPath}/${collection}.json`;
  url.search = "";
  url.hash = "";
  return url;
}

function elementLifecycleUrl(businessModelUrl: URL, elementId: string, lifecycle: "archival" | "rejection"): URL {
  const url = elementMemberUrl(businessModelUrl, elementId);
  url.pathname = `${url.pathname.slice(0, -5)}/${lifecycle}.json`;
  return url;
}

function parseResponseBody(text: string, successful: boolean, allowEmptySuccess = false): unknown {
  if (text.trim() === "") {
    if (successful && !allowEmptySuccess) throw incompatible("Strapivo returned an empty success response");
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    if (successful) throw incompatible("Strapivo returned invalid JSON", { cause: error });
    return null;
  }
}

function apiError(status: number, body: unknown): CliError {
  const envelope = apiErrorEnvelope(body);
  const fallbackCode = statusCodeName(status);
  const message = envelope?.error.message ?? `Strapivo returned HTTP ${status}`;
  const code = envelope?.error.code ?? fallbackCode;
  const retryable = envelope?.error.retryable ?? status >= 500;
  const options: { retryable: boolean; details?: Record<string, unknown> } = { retryable };
  if (envelope?.error.details !== undefined) options.details = envelope.error.details;
  return new CliError(code, message, exitCodeForStatus(status), options);
}

function apiErrorEnvelope(value: unknown): ApiErrorEnvelope | undefined {
  if (!isRecord(value) || !isRecord(value.error)) return undefined;
  const error = value.error;
  if (typeof error.code !== "string" || typeof error.message !== "string") return undefined;

  const normalized: ApiErrorEnvelope = {
    error: {
      code: error.code,
      message: error.message,
      retryable: typeof error.retryable === "boolean" ? error.retryable : false,
    },
  };
  if (isRecord(error.details)) normalized.error.details = error.details;
  return normalized;
}

function exitCodeForStatus(status: number): number {
  if (status === 401) return ExitCode.unauthorized;
  if (status === 403) return ExitCode.forbidden;
  if (status === 404) return ExitCode.notFound;
  if (status === 409) return ExitCode.conflict;
  if (status === 400 || status === 422) return ExitCode.validation;
  return ExitCode.transport;
}

function statusCodeName(status: number): string {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 400) return "invalid_request";
  if (status === 422) return "validation_failed";
  return "http_error";
}

function responseRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value) || Array.isArray(value)) throw incompatible(`${name} must be a JSON object`);
  return value;
}

function responseString(document: Record<string, unknown>, field: string): string {
  const value = document[field];
  if (typeof value !== "string") throw incompatible(`Response field '${field}' must be a string`);
  return value;
}

function requiredResponseField(document: Record<string, unknown>, field: string): unknown {
  if (!Object.hasOwn(document, field)) throw incompatible(`Response is missing field '${field}'`);
  return document[field];
}

function nullableResponseField(document: Record<string, unknown>, field: string): unknown {
  if (!Object.hasOwn(document, field)) throw incompatible(`Response is missing field '${field}'`);
  return document[field];
}

function streamWriteResult(response: unknown, operation: string): Record<string, unknown> {
  const document = responseRecord(response, "Business Model Stream write response");
  return {
    operation,
    id: requiredResponseField(document, "id"),
    name: requiredResponseField(document, "name"),
    details: requiredResponseField(document, "details"),
    color: requiredResponseField(document, "color"),
    position: requiredResponseField(document, "position"),
    lock_version: requiredResponseField(document, "lock_version"),
    members: requiredResponseField(document, "members"),
  };
}

function incompatible(
  message: string,
  options: { cause?: unknown; details?: Record<string, unknown> } = {},
): CliError {
  return new CliError("incompatible_response", message, ExitCode.incompatibleResponse, options);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
