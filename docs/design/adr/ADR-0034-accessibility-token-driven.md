# ADR-0034 · Make accessibility settings token-driven and brand-exempt

Status: **Proposed** (2026-10-04, phase D0). Largely already true; this records it and adds the guard.

## Context

Text size, density, line height, text spacing, reading width, calm, contrast and corners are tokens set in look.ts and applied as inline custom properties; data-calm, data-contrast and data-workspace are attributes. Tenant brand.accent_color is policy only (config-tiers.ts:64) with no consumer and no test.

## Proposed decision

Accessibility and safety tokens (focus, error, warn, status, target sizes, reduced-motion zeroing) are not overridable by any tenant or campaign setting. A test fails if a tenant-controlled value can reach those tokens.

## Consequences

Adds one test; no visual change. Documents the tokens that are exempt.

## Evidence

app/src/lib/look.ts:118,502,532,595,747,767; app/src/styles/tokens.css; app/src/lib/governance/config-tiers.ts:64.

## Not decided here

None.
