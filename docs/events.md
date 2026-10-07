# Local event contract

CRO emits CloudEvents-compatible JSON. Events must not contain passwords, tokens, cookies, authorization headers, form contents, or screenshots.

## Event types

```text
template.import_rejected
template.signature_invalid
template.revoked
template.update_available
credential.rotation.approval_required
credential.rotation.mfa_required
credential.rotation.started
credential.rotation.succeeded
credential.rotation.failed
credential.rotation.state_ambiguous
vault.update_failed
credential.compromised
runner.unavailable
```

## Example

```json
{
  "specversion": "1.0",
  "id": "018f...",
  "type": "credential.rotation.state_ambiguous",
  "source": "local/credential-rotation-orchestrator",
  "subject": "account/opaque-id",
  "time": "2026-10-07T09:15:00.000Z",
  "datacontenttype": "application/json",
  "data": {
    "site": "https://example.com",
    "reason": "vault_update_failed"
  }
}
```

## Planned transports

1. local REST history;
2. Server-Sent Events for the frontend;
3. signed outbound webhooks with retry and deduplication IDs;
4. MQTT 3.1.1/5.0 structured CloudEvents;
5. JSON Lines and syslog for local administration.

The API listens on loopback by default. LAN exposure will require explicit configuration and authentication.
