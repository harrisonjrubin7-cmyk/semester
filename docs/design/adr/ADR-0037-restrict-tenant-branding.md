# ADR-0037 · Restrict tenant branding from safety, status, consent and accessibility UI

Status: **Proposed** (2026-10-04, phase D0). Largely policy today; this adds enforcement.

## Context

BRAND-PLATFORM.md §2.1/4.1 declares brand-exempt zones; no code consumes brand.accent_color, and --status-success/--status-info alias --app-accent.

## Proposed decision

Tenant branding is limited to a logo and one accent applied to an allow-list of tokens. Status, provenance, consent, AI label, warning, error, focus and accessibility controls read only non-brand tokens. Success and info stop aliasing the accent (see U-4).

## Consequences

A test enumerates the tokens a tenant value may reach. Before any tenant accent is wired, status tokens must be decoupled.

## Evidence

app/src/lib/governance/config-tiers.ts:64; app/src/styles/tokens.css:89-97; docs/BRAND-PLATFORM.md:327.

## Not decided here

Whether tenant logos may appear in the Ink chrome.
