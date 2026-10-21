# SEM-02 — Source authority and freshness on every fact

Status: Proposed build specification, 2026-10-08. Not a verified implementation, test result, deployment, certification or approved commitment.

## Accountable roles and dependencies
Proposed owner: Data platform + institutional domain owner. Actual owner is unassigned.
Dependencies: Canonical fact envelope, ingestion, policies, UI trust components.

## Requirements
Represent each displayed assertion with authority category, source record, source version, observed_at, effective_at, freshness rule and derivation lineage. Distinguish source update time from ingestion time. Unknown or conflicting freshness is visible, not silently current.

## Workflow
Ingest → validate authority/mapping → record fact envelope → evaluate policy-specific staleness → display label/details → block stale consequential execution or refresh.

## Acceptance tests
A stale hold cannot authorize enrollment; an AI summary cites input versions; a conflict between syllabus and official calendar displays accountable resolution route.

## Metrics to define and measure
facts with complete provenance; unresolved conflicts; stale-critical-fact count; successful refreshes. Define eligible population, numerator/denominator, observation window, source, exclusions, uncertainty and owner before reporting. No achieved values or universal targets are asserted.

## Activation boundary
Every displayed fact needs provenance or an explicit user-entered/unknown label. Freshness windows require domain-owner approval, not universal timestamps.

All relevant tenant isolation, privacy, source-authority, accessibility, monitoring/support, audit, recovery and institutional authorization gates remain mandatory. Evidence attaches to exact artifact/configuration and tenant/domain scope. Unresolved critical isolation, prohibited egress, unauthorized-action or official-integrity defects block activation.

## Existing evidence and implementation handoff
Source IDs: file:109. Existing design references are not proof of working production behavior. Audit relevant repository objects before coding; record exists/extend/new decisions and reuse shared contracts. Attach code/configuration mapping, scoped test output, independent review, institution approval and activation receipt separately.
