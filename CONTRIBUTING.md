# Contributing

The project is in an architecture-first phase. Security properties take precedence over feature count.

Before proposing code:

1. read `SECURITY.md` and `docs/threat-model.md`;
2. add tests for every new failure mode;
3. avoid dependencies unless their benefit justifies supply-chain cost;
4. never commit real credentials, cookies, browser profiles, screenshots, or signing keys;
5. keep templates declarative and origin-restricted.

Run:

```bash
npm ci --ignore-scripts
npm run check
```

Changes affecting template validation, signatures, recovery, or vault adapters require explicit security rationale in the pull request.
