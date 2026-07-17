---
name: strapivo
description: >-
  Read and maintain Strapivo Strategic Memory through the strapivo CLI. Use
  when a user asks about a Workspace, Business Model, Business Model Canvas,
  Business Model Element, or saved strategic context in Strapivo; when an
  agent needs Strapivo memory before reasoning; or when asked to create or
  update Strapivo Business Models or Business Model Elements.
compatibility: Requires the strapivo CLI (@strapivo/cli), Node >=22, and configured Strapivo API access.
metadata:
  author: strapivo
  version: "0.1.0"
---

# Strapivo Strategic Memory

Use `strapivo` as deterministic transport into Strapivo Strategic Memory. Current API surface covers Workspaces, Business Models, and Business Model Elements. CLI emits JSON only and never prompts.

## Preflight

React to CLI output; do not pre-run checks every turn.

- Command missing: tell user `strapivo` is unavailable. With explicit permission and Strapivo GitHub access, install from the private repository using the README flow: `gh auth setup-git`, then `npm install -g git+https://github.com/strapivo/strapivo-cli.git`. Never install silently, use sudo, or expose credentials.
- Config error: run `strapivo config` to inspect redacted effective config. User configures it with `strapivo config set --base-url URL` and token piped to `strapivo config set --token-stdin`. If config JSON is invalid, ask before `strapivo config reset`, then reconfigure it. Never ask user to place token in command arguments or chat.
- Never print, inspect, summarize, or transmit `~/.config/strapivo/config.json` directly. `strapivo config` is safe and redacted.

## Discover, then act

1. Run `strapivo usage` once when command surface is unknown.
2. Run `strapivo <command> usage` before first use of that command family.
3. Never invent flags, payload fields, lifecycle operations, or endpoints. CLI usage is authoritative.

## Targeting

- Use `strapivo workspaces list` when Workspace slug is unknown.
- Require an explicit Workspace for every scoped operation.
- Never guess a write target from names, prior sessions, or shell state.
- Read selected Business Model before reasoning about or changing it.
- Treat all IDs as opaque strings.

## Writes

Writes accept complete JSON through `--input -` or a file. Prefer stdin with a quoted heredoc. Do not build JSON through shell interpolation.

Before updating:

1. Read current resource.
2. Preserve every complete mutable field the user is not changing.
3. Send exact `lock_version` from that read.
4. On `stale_object` / exit code 8, stop. Read again, explain conflict, reconcile semantically, then write only with user intent.

Create requests have no idempotency key. Never retry a create automatically after timeout, connection loss, or uncertain response. Read and reconcile first to avoid duplicates.

New Business Model Elements become `ai_drafted` and `proposed`. Updates preserve existing lifecycle state and directly change existing content, including accepted content. Perform direct updates only when user's request clearly authorizes that change.

Return operation, resource ID, status when present, and concise review handoff after writes.

## Current limits

No approval, rejection, archival, deletion, token management, bulk sync, or idempotent create operations. Do not use browser routes, HTML actions, or undocumented endpoints to bypass these limits.

## Errors

- Success: JSON on stdout, exit code 0.
- Failure: `{ "error": { "code", "message", "retryable", "details"? } }` on stderr, nonzero exit.
- Surface authorization and validation errors without hiding server detail.
- `retryable: true` does not authorize blind retry. Optimistic-lock conflicts require reread and reconciliation; uncertain creates require duplicate checks.
