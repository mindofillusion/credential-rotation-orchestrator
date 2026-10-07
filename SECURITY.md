# Security policy

## Prototype status

The current release is a simulation. Do not connect it to real credentials or expose its local HTTP port beyond loopback.

Version 0.2 stores a local signing identity. Run it under a dedicated non-administrator OS account and keep the runtime directory private. Its filesystem-backed master key is not equivalent to a native OS keychain; see [Local storage and identity](docs/local-security.md).

## Reporting a vulnerability

Do not open a public issue containing credentials, browser-session data, exploit payloads, or private site information. Until a private disclosure channel is published, provide only a minimal non-sensitive notice in a GitHub issue requesting private contact.

## Security invariants

- Secret values must never appear in logs or events.
- Templates cannot execute arbitrary code.
- Network destinations must be explicitly signed and HTTPS.
- Manual imports must match an expected bundle digest and an already trusted signing key.
- A failed verification must never be treated as success.
- A failed vault update after remote success must enter recovery state.
- The service binds to loopback unless an operator explicitly changes it.
