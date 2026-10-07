# Credential Rotation Orchestrator

Credential Rotation Orchestrator (CRO) is a local-first, vault-agnostic project for safely remediating compromised, weak, or reused credentials. It is designed to coordinate password changes on websites without sending credentials, browser sessions, or private history to a central service.

> [!WARNING]
> This repository is an early security prototype. The default mode uses a simulated vault and website runner. An explicit phpBB SIT mode now performs real rotations against a dedicated local test forum and Vaultwarden test account. Do not use production credentials.

## Current prototype

The current milestone validates the parts that must fail safely and adds a local template workshop:

- declarative templates with an explicit action allowlist;
- exact HTTPS origin restrictions by default; one fixed loopback HTTP origin is permitted only in explicitly enabled phpBB SIT mode;
- SHA-256 integrity checks bound to a signed manifest;
- Ed25519 signature verification;
- transaction states for remote change, independent verification, and vault update;
- recovery state when a remote password changes but the vault cannot be updated;
- CloudEvents-compatible local alerts with secret redaction;
- a standalone local web interface;
- a persistent Ed25519 signing identity whose private key is encrypted with AES-256-GCM;
- private local storage directories and atomic JSON writes;
- template creation, static validation, signing, export, and verified import;
- explicit signer trust using an independently checked public-key fingerprint;
- simulations for success, remote rejection, ambiguous verification, and vault synchronization failure.

The opt-in phpBB SIT integration uses Playwright and the restricted NAS Vaultwarden gateway. The standalone interface can execute a locally signed declarative phpBB template; this remains limited to the controlled test fixture. See [phpBB SIT setup and validation](sit/phpbb/README.md).

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm ci --ignore-scripts
npm test
npm start
```

Open <http://127.0.0.1:8787>. The server binds to loopback by default.

Runtime data is stored in `.cro-data/` by default. Choose another private directory with `--data-dir /path` or `CRO_DATA_DIR`. The generated master key and encrypted signing identity are never committed.

## Security model

CRO separates six responsibilities:

1. the local user interface;
2. the policy and transaction controller;
3. the password-vault adapter;
4. the isolated browser runner;
5. signed declarative templates;
6. a public registry that never receives credentials.

A template signature proves provenance, not safety. Signed templates remain subject to capability checks, domain restrictions, static validation, simulation, and runtime isolation.

The local identity encryption currently relies on a separate `0600` master-key file owned by the same operating-system account. It protects against accidental disclosure and copied identity files, but not compromise of that account. Native OS keychain integration remains required before production use.

Read:

- [Architecture](docs/architecture.md)
- [Threat model](docs/threat-model.md)
- [Template format](docs/template-format.md)
- [Event contract](docs/events.md)
- [Roadmap](docs/roadmap.md)
- [Security policy](SECURITY.md)
- [Local storage and identity](docs/local-security.md)
- [Playwright action-fragment import and limitations](docs/codegen-import.md)

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
