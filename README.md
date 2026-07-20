<p align="center">
  <img src="assets/strapivo-logo.svg" alt="Strapivo" width="480">
</p>

# Strapivo CLI

Machine-first CLI for giving external agents deterministic access to Strapivo Strategic Memory. It exposes Workspaces, Business Models, Business Model Elements, and Business Model Streams through Strapivo's JSON API.

## Install

Node.js 22 or newer is required. Install the public npm package, install its bundled skill for your agent, then verify the CLI:

```sh
npm install -g @strapivo/cli@latest
strapivo skill install --host agents
strapivo version
strapivo usage
```

`--host agents` installs to `~/.agents/skills/strapivo` for agents-compatible hosts. Use `--host claude` for Claude Code or `--host all` for both destinations.

Updating uses the same flow and refreshes the managed skill:

```sh
npm install -g @strapivo/cli@latest
strapivo skill install --host agents
strapivo version
```

Never use `sudo`. If npm reports a permissions error, fix the user-level npm prefix instead of escalating privileges.

### Install with a coding agent

Copy this prompt into your current agent:

```text
Install or update @strapivo/cli from public npm, install its bundled Strapivo skill for this coding agent, and verify it. You are authorized to run the required shell commands and perform a user-level global npm installation. Require Node.js >=22, never use sudo, choose the explicit skill host matching this agent, and stop with an actionable error if installation fails. Run strapivo version and strapivo usage after installation. Do not configure, inspect, request, or print Strapivo API credentials.
```

## Requirements

- Node.js 22 or newer; Node 24 LTS recommended
- Strapivo API URL and bearer token

## Development installation

```sh
git clone git@github.com:strapivo/strapivo-cli.git
cd strapivo-cli
npm install
npm run build
npm link
```

## Configuration

Config lives at `~/.config/strapivo/config.json`:

```json
{
  "base_url": "https://strapivo.app",
  "api_token": "replace-with-token"
}
```

Set it without putting the token in shell history:

```sh
strapivo config set --base-url https://strapivo.app
printf '%s' "$STRAPIVO_API_TOKEN" | strapivo config set --token-stdin
strapivo config
```

`strapivo config` redacts the token. Config values override matching `STRAPIVO_URL` and `STRAPIVO_API_TOKEN` environment variables; missing config values fall back to those variables. If malformed config cannot be read, `strapivo config reset` removes it so configuration can be recreated.

## Agent protocol

Every success writes JSON to stdout. Every failure writes a structured error to stderr and exits nonzero. Commands never prompt.

Discover commands rather than guessing:

```sh
strapivo usage
strapivo business-model usage
strapivo business-model-element usage
```

Workspace-scoped commands require an explicit Workspace slug. Writes consume complete tool-shaped JSON from stdin or a file:

```sh
strapivo business-model read --workspace acme --id 41f974b63df9

strapivo business-model write --workspace acme --input - <<'JSON'
{
  "business_model_id": null,
  "lock_version": null,
  "name": "Acme Italy",
  "url": "https://example.com",
  "context_notes": "Current operating context"
}
JSON
```

Business Model Streams are read through their complete Business Model. Use the Stream command families for metadata and membership writes:

```sh
strapivo business-model-stream usage
strapivo business-model-stream-membership usage
```

See `skills/strapivo/SKILL.md` for agent workflow and safety guidance.

## Development

```sh
npm run check
npm test
npm pack --dry-run
```

Canonical API documentation lives in the sibling Strapivo application repository under `../strapivo/docs/api/`.
