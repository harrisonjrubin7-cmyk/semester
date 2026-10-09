# Capability operating contract

## Objective

Make every canonical Semester capability answer the same eight operating questions without creating a second capability, permission, consent, maturity, or release model. The contract must be derived from the existing capability definitions and exposure resolver, and it must preserve every product category in the founding thesis.

## Truth boundaries

- Product maturity, release authorization, tenant activation, integration health, institutional approval, and general availability remain separate facts.
- A repository test or generated contract does not activate a tenant or prove an integration, support roster, incident owner, or metric result exists in production.
- `live` remains available only through the existing exposure resolver after exact-target release authorization and all operational-readiness categories pass.
- Connected, high-risk, family, institutional, marketplace, and AI capabilities use the shared identity, tenancy, consent, entitlement, evidence, and kill-switch controls. No vertical receives a bypass.
- Web and PWA are the current cross-platform surfaces. Native mobile remains planned but not exposed until separately implemented and verified.

## Contract

Each entry in `CAPABILITY_EXPOSURE_INDEX` must expose:

1. Governed core data entities, including authority, purpose, classification, and retention source.
2. Shared identity, tenant, consent, entitlement, evidence, and activation rules.
3. Student, family, institution, partner, and operator audiences, derived conservatively from the canonical capability definition.
4. Product maturity and the only permitted exposure-state vocabulary.
5. Value-measure definitions for successful task completion, fallback use, and support burden. These are measurement requirements, not claims that results have been collected.
6. The existing capability-specific unavailable-source fallback.
7. Current web/PWA posture and an explicit native-mobile status.
8. Audit, support, and incident workflow references plus accountable role labels.

## Implementation boundaries

- Extend the existing exposure index; do not introduce another manually maintained 60-row registry.
- Derive all entries from `CAPABILITY_DEFINITIONS` and shared constants.
- Keep audience derivation deterministic and conservative: every capability is student-facing; family is added only for the family capability; institution and operator are added for controlled and high-risk capabilities; partner is added only when an external provider is a data authority.
- Measurement definitions must use privacy-preserving device-local or approved aggregate collection and must not introduce student surveillance, content capture, or predictive risk scoring.
- Validation must fail when any canonical capability lacks one of the eight answer categories or cites a missing operating reference.

## Verification

- Focused unit tests prove all 60 entries have a complete contract and that family, provider, controlled, and high-risk audiences are derived correctly.
- A mutation test supplies an intentionally incomplete entry and proves validation rejects it.
- Existing exposure tests continue to prove `live` cannot be reached with incomplete operational evidence.
- Type checking, lint, university checks, the ordered test suite, shuffle tests, and production build remain required before release.
- HawkScan must run after the code change; if local credentials/runtime are unavailable, the hosted HawkScan check is a merge gate.
