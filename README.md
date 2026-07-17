# Strapivo CLI

Machine-first CLI for giving external agents deterministic access to Strapivo Strategic Memory. V1 exposes Workspaces, Business Models, and Business Model Elements through Strapivo's current JSON API.

## Install with Codex or Claude Code

Copy this prompt into your agent. It authorizes installation but not access to secrets:

```text
Install or update the Strapivo Strategic Memory integration for me. You are explicitly authorized to run shell commands, install the user-level CLI, and install/update the personal Strapivo skill for Codex and Claude Code. Do the installation; do not only tell me which commands to run.

1. Verify Node.js >=22, npm, and the GitHub CLI (`gh`) are available. Never use sudo. If a prerequisite is missing, stop and tell me exactly what I need to install.
2. Run `gh auth status`, then confirm access with `gh repo view strapivo/strapivo-cli`. If authentication or repository access fails, stop and tell me; never display or request a GitHub token in chat.
3. Install from the private repository without changing my Git credential configuration: create a temporary directory; clone `strapivo/strapivo-cli` there with `gh repo clone ... -- --depth 1`; run `npm ci` in the clone; run `npm pack --pack-destination <temporary-directory>`; globally install the resulting `.tgz` with `npm install -g <tarball>`; then remove the temporary directory. Keep every temporary path safely quoted.
4. Run `strapivo skill install --host all` to install the bundled skill into the personal Codex and Claude Code skill directories.
5. Verify with `strapivo version`, `strapivo usage`, and confirm both installed skill paths exist.
6. Report what was installed and whether I need to restart my agent for skill discovery.

Do not configure Strapivo API credentials, ask me to paste an API token into chat, or read `~/.config/strapivo/config.json`. I will configure access separately.
```

Repository is private. User must belong to Strapivo GitHub organization or otherwise have repository access.

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

See `skills/strapivo/SKILL.md` for agent workflow and safety guidance.

## Development

```sh
npm run check
npm test
npm pack --dry-run
```

Canonical API documentation lives in the sibling Strapivo application repository under `../strapivo/docs/api/`.
