# Credential Rotation Orchestrator

Credential Rotation Orchestrator (CRO) is a local-first, vault-agnostic project for safely remediating compromised, weak, or reused credentials. It is designed to coordinate password changes on websites without sending credentials, browser sessions, or private history to a central service.

> [!WARNING]
> This repository is an early security prototype. Version `0.1.0` uses a simulated vault and simulated website runner. It must not be used with real credentials yet.

## Current prototype

The first milestone validates the parts that must fail safely:

- declarative templates with an explicit action allowlist;
- exact HTTPS origin restrictions;
- SHA-256 integrity checks bound to a signed manifest;
- Ed25519 signature verification;
- transaction states for remote change, independent verification, and vault update;
- recovery state when a remote password changes but the vault cannot be updated;
- CloudEvents-compatible local alerts with secret redaction;
- a standalone local web interface;
- simulations for success, remote rejection, ambiguous verification, and vault synchronization failure.

There is intentionally no real Vaultwarden adapter and no real Playwright runner in this release.

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm ci --ignore-scripts
npm test
npm start
```

Open <http://127.0.0.1:8787>. The server binds to loopback by default.

## Security model

CRO separates six responsibilities:

1. the local user interface;
2. the policy and transaction controller;
3. the password-vault adapter;
4. the isolated browser runner;
5. signed declarative templates;
6. a public registry that never receives credentials.

A template signature proves provenance, not safety. Signed templates remain subject to capability checks, domain restrictions, static validation, simulation, and runtime isolation.

Read:

- [Architecture](docs/architecture.md)
- [Threat model](docs/threat-model.md)
- [Template format](docs/template-format.md)
- [Event contract](docs/events.md)
- [Roadmap](docs/roadmap.md)
- [Security policy](SECURITY.md)

## Project principles

- No master password storage.
- No secrets in logs, events, screenshots, or templates.
- No arbitrary JavaScript in ordinary templates.
- No network access outside signed origins.
- No vault update before independent remote verification.
- Stop and require intervention whenever state is ambiguous.
- Scheduled rotation is opt-in; event-driven remediation is the recommended default.
- The central registry distributes signed public metadata only and never calls local installations.

## Status

The code is suitable for design review and simulation only. See the roadmap before proposing production integrations.

## License

Apache License 2.0. See [LICENSE](LICENSE).
