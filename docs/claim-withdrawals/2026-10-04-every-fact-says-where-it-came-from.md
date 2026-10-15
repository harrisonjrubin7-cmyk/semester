# Withdrawal: "Every fact says where it came from"

This entry came from the dry run of the withdrawal runbook (§9 of
[`../CLAIM-WITHDRAWAL-RUNBOOK.md`](../CLAIM-WITHDRAWAL-RUNBOOK.md)). **Nothing on a public surface has been changed yet.**

| Field | Value |
| --- | --- |
| Status | OPEN |
| Claim | `Every fact says where it came from.` (and the variants "Every fact shows where it came from", "Every fact carries a source label", "Every fact in Semester carries a label") |
| Detected | 2026-10-04T16:19Z |
| Completed | — |
| Trigger | Unsupported and over-broad: the evidence file for the proposed `CLM-018` shows source labels on 30 component and screen files, not on every fact. Unsupported is not shown false |
| Register rows | M-09b, CLM-018 |
| Escalation | Not required under runbook §3: not shown false; not one of the sensitive categories; no personal data; no known reliance. Product, Engineering and Accessibility seats are unassigned, so nobody has reviewed it |
| Owner | Claim-owner |

## Channels

Searched on 2026-10-04 with `grep` over text files (0.46 s) and by extracting the
12 binary files in `app/public` (0.20 s). Locations are `file:line` on `main` at
`3aa6138`.

| Channel | Location | State | Notes |
| --- | --- | --- | --- |
| Registers and brand documents | `PUBLIC-CLAIMS-APPROVAL-REGISTER.md`, `docs/BRAND-PLATFORM.md`, copy register `M-09` | Removed | Done in PR #1208; the sentence is now the prohibited row `M-09b` |
| Planning document | `docs/gtm/BRAND-AND-MARKETING-STRATEGY.md:79` | Removed | Corrected in this change to the scoped `M-09` wording |
| Public company site | `company-site/index.html:579` | Open | "Every fact labelled with origin and freshness." |
| Public company site | `company-site/index.html:1216` | Open | FAQ: "Every fact shows where it came from…" |
| Public company site | `company-site/index.html:2432` | Open | Trust table: "Every fact carries a source label…" |
| Public company site (script) | `company-site/site.js:558` | Open | "Every fact records where it came from and when it was last updated." |
| Public company site (script) | `company-site/site.js:654` | Open | "Every fact says whether it's official, imported, student-entered or estimated." |
| Template schools may copy | `company-site/site.js:1375` | Open | "Every fact in Semester carries a label…". Copies a school has already used cannot be recalled |
| Public page in the app | `app/src/site/more.tsx:529` | Open | "Every fact in Semester carries one of five labels." |
| Binary assets | `app/public/decks` and `app/public/handouts` (12 files) | Not present | Extracted and searched: no hits |
| Internal standards and benchmark documents | `docs/operating-model/BENCHMARK.md:32`, `docs/MARKET-LEADERSHIP.md:49`, `docs/ONE-OPERATING-SYSTEM.md:302` | Out of scope | Internal statements of intent, not public claims. Listed for completeness; not reviewed further |
| Sales decks, RFP answers, email, meetings | Not in the repository | Open | **Not searched.** No asset registry exists (B-38) |
| Social, email lists, app stores, marketplace, press kit, ambassadors | None switched on, per `M-36` and `CHANGELOG.md` | Not present | Taken from those documents; not independently confirmed |
| Third parties | None known | Open | **Not searched** |

## What closing it needs

- **A decision on the public copy.** The only compliant fix is removal or a sentence that already has an approved register row. The scoped wording is `CLM-018`, which is **proposed, not approved**, so it cannot be the replacement yet. Either remove the sentences, or approve `CLM-018` first.
- The deploy and the live check, with the time recorded: **the time to remove from all channels is still unknown.**
- The two `Open` rows that were not searched.

## Root cause and prevention

`M-09` was first written as an unscoped claim and cited the design guide's
principle and `lib/source.test.ts`, which describe the **intent** and the
**vocabulary**, not coverage. `copyregister.test.ts` checks that a row has
evidence, not that the evidence supports the quantifier. The gate that would have
caught it is a copy lint for universal quantifiers on public surfaces (B-14);
it would currently fail on the seven rows above, which is the point.
