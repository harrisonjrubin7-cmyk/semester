# Semester vendor inventory template

> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

| Control | Draft value |
| --- | --- |
| Version | 0.1 |
| Effective date | `[TO BE APPROVED]` |
| Owner | Vendor Management Lead |
| Review frequency | Monthly changes; quarterly access/contract reconciliation; before renewal; annual completeness review |
| Approval authority | Authorized signer and domain reviewers under procurement policy |
| Dependencies | Procurement policy, risk assessments, contract repository, data/asset inventories, accounting records |

## Purpose

Maintain one controlled register of vendors and other third parties with company spend, data, access, operational dependency, or contractual obligations.

## Register

| ID | Vendor/service | Owner/back-up | Purpose | Risk tier | Data/access/environment | Contract/DPA/status | Cost/term/renewal | Assurance/review | Region/subprocessors | Exit/deletion | State |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V-001 |  |  |  |  |  |  |  |  |  |  | PROPOSED / ACTIVE / RESTRICTED / EXITING / CLOSED |

## Required supporting fields

Legal entity and contacts; approvers; account/tenant IDs without secrets; billing owner; data roles/categories/subjects; OAuth/API/admin scopes; AI model/data use; incident/support contacts; accessibility status; criticality and alternatives; review/assurance expiry; auto-renewal/notice date; approved claim language; open risks/exceptions; offboarding evidence; record locations.

## Reconciliation controls

- Compare quarterly with accounting/card statements, SSO/admin consoles, repositories/secrets, network/CSP and edge-function hosts, cloud projects, contracts, and owner attestations.
- Investigate unregistered spend, access, data transfer, browser extension, trial, or auto-renewal.
- Expired review/contract/evidence or missing owner moves the vendor to restricted review; critical use may require fail-closed action.
- Remove access, rotate secrets, stop billing/data flow, and record return/deletion at closure.

The code-level party list in [`app/src/lib/trust/subprocessors.ts`](../../app/src/lib/trust/subprocessors.ts) is one reconciliation source, not the complete legal/commercial inventory.

## Cannot be completed from source code

Actual vendors/accounts, spend, contracts, approvals, access, assurance, regions, renewal, incidents, deletion, and ownership require controlled company/provider records.
