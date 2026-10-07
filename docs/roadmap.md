# Roadmap

## 0.1 — Safe simulation

- [x] standalone local interface
- [x] Ed25519 manifest verification
- [x] SHA-256 payload binding
- [x] declarative action allowlist
- [x] exact HTTPS origin checks
- [x] transaction state machine
- [x] secret-redacted CloudEvents
- [x] failure simulations and unit tests

## 0.2 — Local template workshop

- [x] persistent local template store with atomic writes
- [x] encrypted filesystem-backed local signing identity
- [ ] operating-system keychain-backed local signing identity
- [x] import/export bundles with expected SHA-256 verification
- [x] explicit public-key trust by independently verified fingerprint
- [x] template editor and static validator
- [x] strict Playwright action-fragment ingestion with fill-value removal
- [ ] full Codegen locator support and recorder integration
- [ ] replay against a purpose-built test website

## 0.3 — Vaultwarden integration

- [ ] explicit read-only connection test
- [ ] ephemeral unlock session
- [ ] scoped entry selection
- [ ] verified update with synchronization checks
- [ ] encrypted recovery store
- [ ] integration tests against an isolated disposable Vaultwarden instance

## 0.4 — Isolated browser runner

- [ ] Playwright worker
- [ ] per-run browser context
- [ ] network allowlist enforcement
- [ ] MFA/manual checkpoints
- [ ] fresh-session verification
- [ ] resource and time limits

## 0.5 — Registry and integrations

- [ ] signed repository metadata and revocation
- [ ] provenance and transparency records
- [ ] outbound HMAC webhooks
- [ ] MQTT transport
- [ ] Home Assistant and Node-RED examples

## 1.0 criteria

- independent security review;
- stable template schema;
- recovery drills passing under forced failures;
- no known secret leakage paths;
- documented key rotation and registry compromise procedure;
- at least three maintained site templates with compatibility tests.
