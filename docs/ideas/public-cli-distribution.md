# Public CLI distribution and agent installation

Status: idea and release plan. No implementation decision beyond items marked **Decision**.

## Goal

A user should be able to tell their current coding agent:

> Install or update Strapivo, connect it to this coding agent, and verify it. Do not configure credentials.

The agent should run a few stable commands. It should not reproduce package-manager logic from a long prompt.

## Decisions

- **No Homebrew yet.** Reconsider after observing real installation friction.
- **Use the MIT License**, matching `wacli`.
- Prefer a **public CLI repository and public npm package** if final security review passes.
- Keep Strapivo API credentials and server authorization as the security boundary. Do not depend on client-source secrecy.
- Version CLI and bundled agent skill together.
- Never update automatically or silently.
- Never fetch the installed skill independently from repository `main`.

License notice:

```text
Copyright (c) 2026 Strapivo Ltd.
```

## Current state

Current private installation asks an agent to:

1. Verify Node.js, npm, and `gh`.
2. Verify GitHub authentication and private repository access.
3. Download a release tarball and checksum.
4. Verify the checksum.
5. Install the tarball globally with npm.
6. Install the bundled skill for supported hosts.
7. Verify CLI and skill paths.

This is security-conscious but makes the prompt act as a package manager. Main friction comes from private distribution, not from skill installation.

Existing skill installation is strong:

- Skill ships inside the npm package.
- Installation stages all targets before replacement.
- Managed ownership marker prevents overwriting unmanaged skill directories.
- Commit failure triggers rollback.
- Re-running installation updates a managed copy.
- Current common-agent destination is `~/.agents/skills/strapivo`, exposed as host `codex`.
- Claude Code destination is `~/.claude/skills/strapivo`.

## Lessons from wacli and Peter Steinberger's approach

Transfer:

- Make normal installation short and deterministic.
- Let package manager handle integrity, versions, updates, and uninstall.
- Provide concise verification: version, help/usage, diagnostics.
- Expose machine-readable diagnostics.
- Enforce safety in executable, not only skill prose.
- Keep CLI output stable; avoid building a plugin host when CLI integration is enough.
- Keep end-user usage skill separate from repository-maintainer instructions.
- Make skill synchronization idempotent and host-aware.

Do not copy:

- `wacli`'s repository skill is maintainer-oriented and not a polished cross-agent installer.
- Strapivo's bundled, managed, rollback-safe skill installer is already stronger for end users.
- Human-first default output is not necessary for Strapivo's machine-first contract.
- Native single-binary packaging is optional; do not add complexity before Node/npm proves problematic.

References:

- [wacli installation](https://github.com/openclaw/wacli/blob/136580c2ea85638ae7be88d15a49866c9fc2318d/docs/install.md)
- [wacli doctor](https://github.com/openclaw/wacli/blob/136580c2ea85638ae7be88d15a49866c9fc2318d/docs/doctor.md)
- [wacli integrations](https://github.com/openclaw/wacli/blob/136580c2ea85638ae7be88d15a49866c9fc2318d/docs/integrations.md)
- [wacli repository skill](https://github.com/openclaw/wacli/blob/136580c2ea85638ae7be88d15a49866c9fc2318d/.agents/skills/wacli/SKILL.md)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)

## Preferred first public installation

Do not build an installer script first. Public npm already provides package integrity, version resolution, installation, and updates.

Initial install:

```sh
npm install -g @strapivo/cli@latest
strapivo skill install --host codex
strapivo version
strapivo usage
```

Update:

```sh
npm install -g @strapivo/cli@latest
strapivo skill install --host codex
strapivo version
```

The same flow updates CLI and refreshes the managed skill.

Suggested user instruction:

> Install or update `@strapivo/cli` from npm, install its bundled skill for your current coding agent, and verify it. Do not configure or inspect Strapivo credentials.

### Host naming

Add `agents` as clearer alias for the common `~/.agents/skills` destination. Keep `codex` for compatibility.

Desired examples:

```sh
strapivo skill install --host agents
strapivo skill install --host claude
strapivo skill install --host all
```

Agent should target its current host instead of modifying every supported host. Automatic host detection should be added only if reliable; explicit host selection is safer.

## Skill update lifecycle

Repository skill changes do not affect installed users until released. This is intentional.

Release flow:

1. Update `skills/strapivo/SKILL.md`.
2. Publish a CLI patch/minor release.
3. npm package contains the new skill.
4. User updates CLI.
5. User or installer reruns `strapivo skill install --host <host>`.
6. Managed skill copy is replaced atomically.

Rules:

- Skill-only changes still require a CLI release.
- Never pull `SKILL.md` directly from repository `main`.
- Managed installed skill should not be edited by users; custom guidance should live separately.
- CLI update alone currently does not refresh copied skills. Update documentation must always include skill installation.

Future managed marker:

```json
{
  "managed_by": "@strapivo/cli",
  "skill": "strapivo",
  "cli_version": "0.2.0",
  "skill_sha256": "..."
}
```

Any marker-format change must migrate or recognize the current marker. Exact marker comparison currently protects unmanaged targets; changing format without compatibility would turn valid old installs into conflicts.

Future lifecycle commands:

```sh
strapivo skill status
strapivo skill uninstall --host agents
strapivo doctor
```

`skill status` should report host, path, ownership, bundled version/hash, installed version/hash, drift, and restart requirement.

`skill uninstall` must remove only CLI-managed targets.

`doctor` should be side-effect-free by default and return JSON covering:

- CLI and Node versions
- PATH/install health
- Redacted config readiness
- Optional API connectivity when explicitly requested
- Bundled skill availability
- Installed hosts and paths
- Ownership, version drift, and restart guidance

Possible later safety feature:

```sh
strapivo --read-only ...
STRAPIVO_READONLY=1 strapivo ...
```

Write blocking must be enforced centrally by CLI, not only requested by skill prose.

## Public npm publication

Current audit state at time of writing:

- `@strapivo/cli` does not yet exist on npm.
- Package currently declares `UNLICENSED`.
- `publishConfig.access` currently says `restricted`.
- GitHub repository is private.
- Local npm client was not authenticated during audit.

### Package configuration

Required direction:

```json
{
  "license": "MIT",
  "publishConfig": {
    "access": "public"
  }
}
```

Keep repository URL exactly aligned with public GitHub repository; npm trusted publishing validates it.

### One-time account work

1. Ensure npm organization `@strapivo` exists.
2. Ensure releasing user is an npm organization owner or has publish rights.
3. Enable npm account 2FA.
4. Make GitHub repository public after final audit.
5. Authenticate locally when bootstrapping package:

```sh
npm login
npm whoami
```

6. Publish the first package version from a clean, reviewed release state:

```sh
npm publish --access public
```

Do not publish npm version `0.1.0` after source has moved beyond GitHub release `v0.1.0`. Choose the next valid version.

### Trusted publishing

After package exists, configure npm package settings:

```text
Provider: GitHub Actions
Organization: strapivo
Repository: strapivo-cli
Workflow: release.yml
Allowed action: npm publish
```

Optional: use a protected GitHub environment for release approval.

Workflow requirements:

```yaml
permissions:
  contents: write
  id-token: write
```

```yaml
- uses: actions/setup-node@v6
  with:
    node-version: 24
    registry-url: https://registry.npmjs.org
```

Use npm CLI 11.5.1 or newer with Node 22.14 or newer. Node 24 remains preferred.

Publish with OIDC:

```yaml
- run: npm publish
```

Trusted publishing generates provenance automatically when repository and package are public. No long-lived npm publish token should be stored in GitHub.

After one successful OIDC release:

1. Set npm publishing access to require 2FA and disallow traditional tokens.
2. Revoke obsolete automation tokens.
3. Keep tag/release creation protected.

## Release workflow requirements

Before public release:

- Verify Git tag matches package version.
- Run type check, tests, API compatibility check, and package dry run.
- Build package once from reviewed tag.
- Install packed artifact under isolated npm prefix.
- Use isolated `HOME` to run packaged skill installation.
- Verify managed marker and skill files at each selected host path.
- Run packaged `version` and `usage` commands.
- Publish exact tested artifact to npm.
- Create matching GitHub release.
- Avoid rebuilding materially different npm and GitHub artifacts.

Recommended isolated integration smoke test:

1. Create temporary install prefix.
2. Create temporary `HOME`.
3. Install generated tarball under prefix.
4. Run packaged `strapivo skill install --host all`.
5. Validate both installed `SKILL.md` files and managed markers.
6. Run packaged `strapivo version` and `strapivo usage`.

## Public-readiness audit

Public CLI is reasonable only when server authentication and authorization are the true boundary. Assume every endpoint, payload, and validation rule in client becomes known.

Final audit must cover current final tree and full git history:

- API tokens, GitHub/npm credentials, private keys
- Customer names, PII, fixtures, screenshots, logs
- Internal-only URLs and comments
- Generated source maps and package contents
- npm lifecycle scripts and dependencies
- GitHub Actions permissions and third-party actions
- Server authentication and Workspace authorization
- Tenant isolation and opaque-ID handling
- Rate limits and audit logging where applicable
- README, support route, and security-reporting guidance
- License and copyright holder

Audit snapshot already established:

- Built source maps referenced TypeScript source paths but did not embed `sourcesContent`.
- CLI type check and tests passed during audit.
- Server integration tests were not verified because sibling app lacked checked-out `ruby_llm` git dependency; run `bundle install` before final server test pass.
- Concurrent server auth work and later CLI changes were outside that snapshot. Repeat audit after concurrent work lands.
- Development version mismatch is not a blocker. Release gate is choosing and publishing the next version, not npm `0.1.0`.

## Optional installer script later

Add only if npm/Node/PATH/skill-hookup friction appears in real usage.

Public repository enables script without git or `gh`:

```sh
tmp="$(mktemp)"
curl --proto '=https' --proto-redir '=https' --tlsv1.2 \
  -fsSL https://raw.githubusercontent.com/strapivo/strapivo-cli/main/install.sh \
  -o "$tmp"
sh "$tmp" --host agents
rm -f "$tmp"
```

Prefer download-then-run over undocumented `curl | sh`. Script should be small and auditable.

Script responsibilities:

- `set -eu`, restrictive `umask`, temporary directory, cleanup trap
- Verify Node 22+ and npm
- Never use sudo
- Never read, print, or configure Strapivo API credentials
- Install `@strapivo/cli@latest`, or explicit `--version`
- Refresh bundled skill for explicit host
- Verify CLI version and installed skill
- Return actionable PATH/npm-prefix errors
- Support `--dry-run` and `--no-skill` if needed
- Never silently update

If repository remains private, unauthenticated `curl` cannot fetch installer or release. Options then become `gh` authentication, a public installer repository, or a separate authenticated download service. This complexity is another reason to prefer public npm distribution.

## Rollout order

1. Add MIT license with `Strapivo Ltd.` as copyright holder.
2. Finish concurrent CLI/server work.
3. Repeat final public-readiness audit.
4. Make repository public.
5. Set package license and public npm access.
6. Update README and bundled skill for public install/update flow.
7. Add release integration smoke test for packaged skill hookup.
8. Bootstrap first npm package release with 2FA.
9. Configure npm trusted publisher.
10. Verify OIDC publish and provenance on next release.
11. Disable traditional npm publish tokens.
12. Observe user friction before building installer, Homebrew formula, self-update command, or native binary.

## Open decisions

- Next public version number.
- Whether repository becomes public before or immediately after first npm publish.
- Whether to add `agents` alias before first public release.
- Whether releases require protected GitHub environment approval.
- Whether future installer lives in repository root or separate public installer repository.
