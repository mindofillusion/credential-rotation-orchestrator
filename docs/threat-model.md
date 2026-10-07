# Threat model

## Protected assets

- current and replacement passwords;
- vault unlock material and session keys;
- authenticated browser sessions;
- recovery secrets after partial failure;
- template signing keys;
- site/account associations and audit history.

## Principal threats

### Malicious template

A signed author can still publish harmful behavior. Ordinary templates therefore use a restricted declarative language, exact HTTPS origins, bounded steps, and no arbitrary script or operating-system commands.

### Repository compromise

An attacker may replace a template and its checksum, serve an obsolete version, or freeze update metadata. SHA-256 is necessary but insufficient. Signed, expiring, monotonically versioned metadata and revocation are required. Threshold signatures and a transparency log are planned.

### Browser exfiltration

A compromised page can redirect, open frames, submit data to another origin, or exploit the browser. The runner must use an isolated profile, deny undeclared origins, minimize permissions, and be disposable.

### Partial transaction

The website may accept a new password while verification or vault synchronization fails. CRO must stop, preserve the replacement in an encrypted recovery store, and emit a high-severity event.

### Logging leakage

Exceptions, selectors, URLs, screenshots, and integration payloads can expose secrets. Events are structured and recursively redact secret-like fields. Production runners must disable screenshots by default and strip query strings.

### Local privilege escalation

The controller and runner must run as unprivileged accounts. The browser runner does not need administrator rights. Local keys belong in an operating-system keystore, not configuration files.

## Explicit non-goals for the prototype

- bypassing MFA or CAPTCHA;
- rotating passkeys;
- automating banking or other high-consequence accounts;
- accepting arbitrary JavaScript templates;
- exposing the control API to a LAN or the Internet;
- promising universal rollback.
