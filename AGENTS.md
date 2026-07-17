# Strapivo CLI

Machine-first TypeScript CLI and host-neutral agent skill for accessing Strapivo Strategic Memory.

## Canonical server context

Canonical server repository: `../strapivo`

Before changing API client behavior, read completely:

- `../strapivo/docs/api/README.md`
- All files under `../strapivo/docs/api/`

API docs in the Strapivo repository are canonical. Do not invent undocumented endpoints or duplicate server behavior here. Treat the sibling Strapivo repository as read-only unless a task explicitly requests server changes.

Use domain glossary terms exactly: **Workspace**, **Business Model**, **Business Model Element**, **Strategic Memory**, and related terms from `CONTEXT.md`.

## Build and validation

- Install: `npm install`
- Build: `npm run build`
- Type check: `npm run check`
- Test: `npm test`
- Package check: `npm pack --dry-run`

Node 22 or newer is required. Develop against current Node 24 LTS when possible.

## Client invariants

- JSON success output goes to stdout. Structured errors go to stderr.
- Never print or accept the API token as a command-line argument.
- Config lives at `~/.config/strapivo/config.json` and overrides matching environment variables.
- Never persist a Workspace default. Workspace-scoped writes require an explicit Workspace.
- Treat IDs and server-provided links as opaque.
- Never attach bearer credentials to another origin.
- Never automatically retry create requests.
- Never silently reconcile optimistic-lock conflicts.
- Writes use complete payloads matching Strapivo's internal agent tools.
- Keep `skills/strapivo/SKILL.md` thin. CLI `usage` output is the command reference.
