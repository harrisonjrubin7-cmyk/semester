# Production dependency audit — 2026-10-02

**Candidate commit:** `fc08913447d691cf0fa8ef757dc365a3b7d8275d`
**Package boundary:** `app/`
**Authoritative lockfile:** `app/package-lock.json`
**Lockfile SHA-256:** `c36289bcc78afae3158bd04437f4c5e658214443f9a0834053e230a019f6f9ff`
**Audit client:** npm `10.9.3`, installed into a temporary directory with dependency lifecycle scripts disabled
**Scope:** production dependency graph (`--omit=dev`)
**Threshold:** high (`--audit-level=high`)

## Command

```text
npm audit --audit-level=high --omit=dev
```

## Result

```text
found 0 vulnerabilities
```

The command exited `0`. This is a point-in-time advisory-database result for the lockfile hash above. It is not a penetration test, source-code analysis, DAST result, provider assessment, or guarantee that no unknown vulnerability exists. Repeat on lockfile changes and before each release candidate.
