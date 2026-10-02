# Secret verification — 2026-10-01

## Decision

No production credential was found in the current repository tree, reachable
Git history, release-branch commits, production browser artifact, or isolated
institutional-preview artifact. The go-live secret-verification line may be
marked complete. This does not claim that provider stores or build logs were
audited; those remain operational evidence outside this repository.

## Reproduced checks

| Boundary | Check | Result |
| --- | --- | --- |
| Current tree, including docs and fixtures | Gitleaks 8.28.0 `dir`, `.gitleaks.toml`, redacted output | Pass — 517,438,933 bytes scanned; no leaks |
| Reachable Git history | Gitleaks 8.28.0 `git`, `.gitleaks.toml`, redacted output | Pass — 2,749 commits and 84,887,254 bytes scanned; no leaks |
| Release branch since `origin/main` | Gitleaks 8.28.0 `git --log-opts=origin/main..HEAD`, redacted output | Pass — 22 commits and 114,909 bytes scanned; no leaks |
| Production browser build | `npm run scan:bundle-secrets` | Pass — 451 text artifacts; no credential-shaped values |
| Account-isolated institutional preview build | `node scripts/bundle-secrets.mjs <preview-dist>` | Pass — 451 text artifacts; no credential-shaped values |

The generated-artifact scanner detects private-key blocks, major provider key
prefixes, and Supabase JWTs whose decoded role is `service_role`. It reports
only the rule and artifact path, never the matched value. CI runs it after the
production build, and the Pages workflow runs it after both product and demo
artifacts are assembled and before upload.

## Reviewed exceptions

The full-history scan initially reported `publish-key-0001`, a client-test
fixture, and `employer/alumni`, a product-role route in an old status document.
Both are exact, non-credential shapes. `.gitleaks.toml` allowlists those values,
not their files; credential rules remain active everywhere in the same files.

The scanner's own synthetic Stripe fixture was changed to assemble its fake
value at runtime, and the unpushed commit was amended, so no key-shaped test
string remains in branch history.
