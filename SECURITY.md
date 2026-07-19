# Security Policy

## Supported versions

Security fixes are provided for the latest published version of `@strapivo/cli`. Upgrade to the latest release before reporting an issue that may already be fixed.

## Reporting a vulnerability

Do not open a public issue or discussion for a suspected vulnerability.

Use [GitHub private vulnerability reporting](https://github.com/strapivo/strapivo-cli/security/advisories/new) to report vulnerabilities in the CLI, its packaged skill, or its release process. Include:

- A description of the vulnerability and its impact
- Reproduction steps or a proof of concept
- Affected versions and environment details
- Any suggested mitigation, if known

Reports will be acknowledged as soon as practical. Please allow time to investigate and release a fix before public disclosure.

Vulnerabilities in the hosted Strapivo service or API should be reported through that project's private security channel instead.

## Credential safety

Never include Strapivo API tokens, npm credentials, customer data, or other secrets in a report. Revoke and rotate any credential that may have been exposed.
