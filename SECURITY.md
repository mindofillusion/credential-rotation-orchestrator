# Security policy

## Prototype status

The current release is a simulation. Do not connect it to real credentials or expose its local HTTP port beyond loopback.

## Reporting a vulnerability

Do not open a public issue containing credentials, browser-session data, exploit payloads, or private site information. Until a private disclosure channel is published, provide only a minimal non-sensitive notice in a GitHub issue requesting private contact.

## Security invariants

- Secret values must never appear in logs or events.
- Templates cannot execute arbitrary code.
- Network destinations must be explicitly signed and HTTPS.
- A failed verification must never be treated as success.
- A failed vault update after remote success must enter recovery state.
- The service binds to loopback unless an operator explicitly changes it.
