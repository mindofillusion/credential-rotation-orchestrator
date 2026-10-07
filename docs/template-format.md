# Template format

## Bundle

A distributable template bundle contains:

```text
manifest.json
recipe.json
signature.json
tests/
```

The local workshop represents this structure as one JSON object. Export returns that object and its canonical bundle SHA-256. A later archive format must preserve the same signed relationships.

## Manifest

```json
{
  "schemaVersion": 1,
  "id": "org.example.change-password",
  "version": "1.0.0",
  "createdAt": "2026-10-07T09:00:00Z",
  "expiresAt": "2027-01-07T09:00:00Z",
  "allowedOrigins": ["https://example.com"],
  "permissions": ["browser:navigate", "browser:form-fill"],
  "files": {
    "recipe.json": "SHA256_HEX"
  }
}
```

The Ed25519 signature covers the canonical JSON bytes of the entire manifest. The manifest binds each payload by SHA-256.

## Declarative actions

Prototype actions:

- `navigate`
- `fill-current-password`
- `fill-new-password`
- `fill-confirm-password`
- `click`
- `wait-for`
- `assert-text`
- `assert-url`
- `manual-checkpoint`

Fields named `script`, `javascript`, or `command` are rejected. Navigations must remain inside an exact signed HTTPS origin.

## Trust levels

```text
draft             recorded but unvalidated
local-verified    locally signed and successfully tested
community         identified author, community review
official          project review, tests, release signature
revoked           execution prohibited
```

Automatic execution is never granted solely because a template has a signature.

## Import sequence

1. Obtain the signer public key and fingerprint through independent channels.
2. Approve the key only when its calculated fingerprint matches the expected value.
3. Obtain the bundle and its expected SHA-256 through independent channels.
4. Import only when the bundle digest, manifest signature, recipe digest, action allowlist, expiry, and origins all validate.

The SHA-256 supplied next to an untrusted download is not an independent integrity check.
