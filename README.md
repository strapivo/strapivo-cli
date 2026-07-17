# Strapivo CLI

Machine-first CLI for giving external agents deterministic access to Strapivo Strategic Memory. V1 exposes Workspaces, Business Models, and Business Model Elements through Strapivo's current JSON API.

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
  "base_url": "https://app.strapivo.com",
  "api_token": "replace-with-token"
}
```

Set it without putting the token in shell history:

```sh
strapivo config set --base-url https://app.strapivo.com
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

See `skills/strapivo/SKILL.md` for agent workflow and safety guidance.

## Development

```sh
npm run check
npm test
npm pack --dry-run
```

Canonical API documentation lives in the sibling Strapivo application repository under `../strapivo/docs/api/`.
