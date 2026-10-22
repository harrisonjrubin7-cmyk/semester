# Global expansion architecture

_Semester platform maturity program · 2026-10-05 · Source: uploads/what else is needed to become the apple google and.pdf. Status is design-stage: nothing is "done" until repo code, tests and release evidence exist._

**Principle:** Semester must become the system people prefer to use every day, the system institutions trust to operate, and the system partners prefer to build on.

## Standard

- Internationalization: locale content, translation management, RTL readiness, local calendars and time zones, currency and tax abstraction, address and phone formats, multi-language search, localized policy variants.
- Regional data: residency strategy, region-aware tenants, cross-border documentation, regional subprocessors, local privacy review, retention and accessibility-law mapping, regional payments and SSO.
- Models: US higher ed, community colleges, private and public systems, K–12, international universities, vocational, corporate learning, certification, bootcamps, online universities, government training, lifelong learning. Assume no single calendar, grading scheme, credential or privacy regime.

## Capability record

| Field | Value |
| --- | --- |
| Current evidence | `tokens/ (locale-neutral tokens)`, `docs/legal/Subprocessors.html` |
| Implementation state | Not started beyond US assumptions. |
| Product owner | Engineering |
| Technical owner | Product |
| Risk owner | Counsel |
| Success metrics | Strings externalized; RTL layout check passes; Regions supported; Calendar/grading models supported |
| Launch gate | Before first non-US tenant |
| Next action | Externalize UI strings and remove US-only calendar and grading assumptions from the data model |
| Security / privacy / accessibility | RLS + tenant_id on every row; no student records to AI; WCAG 2.2 AA |
| Replacement authority gate | Institution approval with reconciliation evidence before Semester becomes authoritative for any domain |

## Execute

See `handoff/execute/` streams and `13-platform-maturity.md`.
