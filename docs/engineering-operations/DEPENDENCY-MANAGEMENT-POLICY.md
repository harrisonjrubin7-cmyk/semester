# Dependency Management Policy

| Control | Value |
| --- | --- |
| Status | **CONTROLLED POLICY — LOCKED INSTALLS/PINNING PRESENT; COMPLETE INVENTORY AND REVIEW PARTIAL** |
| Owner | Harrison Rubin — engineering and supply-chain primary; backup maintainer, security reviewer and counsel unassigned |
| Evidence date | 2026-10-03 at repository revision `ccc254d4` |

Add a dependency only for a current requirement that cannot reasonably use platform or existing code. Record purpose, owner, source, version/range, license, transitive/security implications, runtime/build scope, data/network access, maintenance health, alternatives and removal plan. High-risk parsers, authentication, cryptography, upload, AI/provider, payment and server packages require security review.

Use committed lockfiles and clean deterministic installs. Pin CI actions by immutable revision. Keep client/server boundaries explicit; a browser dependency must not receive secrets or undeclared student data. Review automated advisories, but independently assess reachability and compensating controls. Critical/high exploitable findings affecting an activated scope block release until removed, patched or scope-disabled; exceptions require owner, evidence, expiry and cannot waive P0/P1 risk.

Updates run type/lint/test/build, affected policy/browser/database/security checks, bundle/license comparison and deployment rollback review. Remove unused packages and stale exceptions. Emergency updates follow incident/change control and receive retrospective review.

## Evidence state

**Code/config evidence.** Package manifests/lockfiles, clean CI installs, pinned workflow actions and an advisory step provide baseline supply-chain controls.

**Operational evidence.** No current complete software bill of materials, license determination, reachability review, maintainer-risk review or approved vulnerability exception register covers every shipped artifact. The dependency audit is advisory in CI.

**Missing test/proof.** Generate and review an exact-SHA dependency/SBOM and license inventory, reconcile advisories/reachability, assign owners/expiry, verify artifact contents and obtain counsel/security decisions where needed.

## Claim ceiling

Semester may say installs use committed locks and CI actions are pinned, and may cite a dated dependency scan with its limitations.

## Prohibited claims

Do not claim supply-chain security, vulnerability-free dependencies, complete SBOM, license compliance or approved exceptions until current evidence and authorized reviews exist.
