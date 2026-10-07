# Local storage and signing identity

## Layout

The default runtime directory is `.cro-data/`. It is excluded from Git and can be replaced with `--data-dir` or `CRO_DATA_DIR`.

```text
.cro-data/
  identity/
    master.key
    signing-identity.json
  templates/
    <sha256>.json
  trusted-keys.json
```

Directories are set to mode `0700`; files are set to mode `0600`. JSON writes use a same-directory temporary file followed by an atomic rename.

## Signing identity

On first start, CRO creates an Ed25519 key pair. The public-key fingerprint is the SHA-256 digest of the DER-encoded public key. The PKCS#8 private key is encrypted with AES-256-GCM before it is written.

The 256-bit encryption key is stored separately as `identity/master.key`, protected by operating-system file permissions. This is a transitional design, not an OS keychain:

- it prevents the identity JSON alone from exposing the private key;
- it does not protect against malware or another process running as the same user;
- backups must protect both files;
- production releases must use DPAPI, Keychain, Secret Service, or an equivalent hardware-backed/keychain facility.

Run CRO under a dedicated, non-administrator operating-system account. Do not share its runtime directory, mount it into unrelated containers, or synchronize it through a consumer cloud drive.

## Manual trust ceremony

Import has two independent gates:

1. the bundle SHA-256 must match a value obtained outside the bundle;
2. the Ed25519 signer must already be in the local trust store.

Adding a signer requires its PEM public key and a SHA-256 fingerprint verified through an independent channel. A digest detects modification; it does not establish who authored a template.

Approval is local and does not authorize automatic execution. The capability and origin checks still apply.
