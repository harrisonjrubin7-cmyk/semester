> **DRAFT FOR OWNER REVIEW. This is an operational procedure, not legal advice. Counsel decides legal conclusions and notification duties; this document does not.**

# Claim and brand-asset withdrawal runbook

| Control | Value |
| --- | --- |
| Status | **Draft 1.** Not yet adopted. Nobody but the claim-owner has been assigned a role in it |
| Date | 2026-10-04 |
| Owner | Harrison Rubin, claim-owner per [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../PUBLIC-CLAIMS-APPROVAL-REGISTER.md). **The backup claim-owner is unassigned, so withdrawal today depends on one person** |
| Backlog item | B-39 in [`BRAND-PLATFORM.md`](BRAND-PLATFORM.md) |
| Builds on | The register's "Withdrawal and incident rule"; §8.3 of [`BRAND-AND-MARKETING-STRATEGY.md`](gtm/BRAND-AND-MARKETING-STRATEGY.md); the takedown rule in `BRAND-PLATFORM.md` §8.4 |
| Evidence | One dry run on 2026-10-04 (§9). It found the withdrawn sentence **still live on the public site**; see the log entry it produced |

## 1. The rule this implements

From the register: *expired, contradicted, over-broad or unapproved claims must be removed from every channel and logged; a material false claim enters legal, security, privacy and customer-communication escalation as applicable; when evidence or authority is unclear, do not publish.*

§8.3 of the strategy adds a **same-day** target. That target is a proposal and **has never been measured**. B-40 (review capacity) is what turns it into a number; until then this runbook promises no time.

**Pull first, analyse after.** Anyone may remove an out-of-bounds claim from a channel they control without approval. Putting it back needs a new approval record (§8). Removing a true statement by mistake costs a re-approval; leaving a false one up costs more.

## 2. When to use it

| Trigger | Example |
| --- | --- |
| **Contradicted** | A guard test fails, the go/no-go changes, or evidence is found to say otherwise |
| **Unsupported or over-broad** | A universal ("every", "all", "always") where the evidence is partial. This is how the first log entry arose |
| **Expired** | A claim's review-by date passed with no renewal |
| **Unapproved** | Wording used that has no register row, or a row marked ✋ |
| **Dependency closed** | The row's evidence aged out or its gate closed (strategy §8.3) |
| **Third-party request** | A named person, school or partner withdraws permission (`CLM-013`) |
| **Found in the wild** | A partner, ambassador, press piece, school or sales document says something Semester never approved |

## 3. Escalate, or just remove and log?

Everything is removed and logged. **Escalate in addition when any of these is true**, because they are the cases the register treats as higher risk:

1. The evidence shows the claim is **false**, not merely unsupported.
2. It concerns compliance or certification (`CLM-010`), accessibility conformance (`CLM-008`), AI absolutes (`CLM-012`), named customers or logos (`CLM-013`), outcomes (`CLM-014`), price or availability (`CLM-015`), or uptime and support (`CLM-016`).
3. **Personal data** is involved, in the claim or in how it was published.
4. **Someone relied on it**: a customer, a student, a journalist, a school's own communication.

Escalation goes to legal, security, privacy or customer communication as applicable, through the claim-owner. **Whether anything must be notified, to whom and when is a decision for qualified counsel**; this runbook does not make it.

## 4. Channel inventory

Verified against the repository on 2026-10-04. "Cannot remove" is a real state: some copies are beyond Semester's reach, and the log must say so rather than imply otherwise.

| Channel | Where it lives | Remove by | Verify by | What stays out of reach |
| --- | --- | --- | --- | --- |
| **Public company site** | `company-site/index.html`, `company-site/site.js` (project `semester-company-site`) | Edit, regenerate the checksum manifest `company-site/SHA256SUMS`, run the site tests, merge. Whether a merge to `main` publishes to production was **not verified** | Fetch the live page and search it for the exact words | Browser and CDN caches, web archives, search-engine snippets |
| **Public pages inside the app** | `app/src/site/` (e.g. `app/src/site/more.tsx`) (project `semester`) | Edit, run the tests, merge | As above | Cached bundles in open sessions. Whether an offline cache exists was **not checked** |
| **Registered capability claims** | `app/src/lib/ops/claims.ts`, rendered to `ops/claims/README.md` | Edit the data, then `npm run registers` from `app/`. A claim that is removed must also stop being printed on its pages, or the test fails | The claims test | — |
| **In-product copy** | `app/src/lib/privacy.ts` (`CLAIMS`), `app/src/lib/plans.ts` and screens | Edit, test, merge | Search `app/src` | Copies in an installed session until reload |
| **Repository documents** | `README.md`, `docs/`, the registers | Edit via pull request | `git grep` | Forks, clones and **git history, which keeps the old words**. A `git revert` of a withdrawal **reinstates the claim** |
| **Templates schools may copy** | `company-site/site.js`, e.g. the "Student announcement email" and "Privacy and source-label explainer" templates | Edit | Search | **Copies a school has already sent or posted cannot be recalled.** Send a correction (§7) |
| **Binary assets** | `app/public/decks/*.pptx`, `app/public/handouts/*.docx` and `*.pdf` | Regenerate or replace | Extract text first: `unzip -p file \| sed 's/<[^>]*>/ /g'` for `.docx` and `.pptx`, `pdftotext` for `.pdf`. A plain `grep -I` **skips them** | — |
| **Sales decks, RFP answers, emails, one-pagers, meetings** | Not in the repository and **not mapped**: `ops/claims/README.md` says so | Manual search of the owner's files and sent mail | Manual | Anything already sent. **No asset registry exists yet (B-38), so this row cannot be exhaustive** |
| **Social, email lists, app stores, marketplace, press kit, ambassadors** | The strategy (`M-36`) and `CHANGELOG.md` record that none is switched on | Confirm at withdrawal time and write "Not present" | — | — |
| **Third parties** | Partners, press, schools, anyone quoting Semester | A written request to the publisher | Check the page | Whatever they decline to change |

## 5. Procedure

Record each step's time in the log entry (§6). The clock starts at **Detected**.

1. **Detect and open an entry.** Copy the claim's **exact words** into the log; keep them even after the claim is gone, so a search for variants is possible.
2. **Decide escalation** (§3). If yes, start it now, in parallel; do not wait for removal.
3. **Search every channel in §4** for the exact words and for variants: the key nouns, and the same sentence with "every", "all", "always" or "any" swapped in. The dry run's commands are in §9.
4. **Remove or correct, in the order §4 lists the controlled channels.** Prefer removal. A replacement sentence is a **new claim** and needs its own register row and approval at the right tier (`BRAND-PLATFORM.md` §8.2). It cannot be an unapproved or merely proposed row, such as `CLM-018` today.
5. **Verify on the live surface**, not just in the repository. A merged change is not a removal until the deployed page is checked.
6. **Chase what cannot be pulled**: third parties, sent mail, school copies. Record each as `Open` or `Cannot remove`, with the reason.
7. **Write the correction notice** if anyone relied on it or saw it (§7).
8. **Close the entry** only when every channel row says `Removed`, `Not present` or `Cannot remove`. Record **Completed** and what the root cause was.
9. **Prevent recurrence**: name the gate that should have caught it. If it is a phrase, it belongs in the copy lint (B-14).

## 6. The log

One file per withdrawal in [`claim-withdrawals/`](claim-withdrawals/), named `<date>-<slug>.md`, from the template in its README. **One file per entry, not one shared log**, because `CLAUDE.md` records what a shared, numbered, append-only file did to this repository: every pair of open pull requests collided on it.

`app/src/lib/gtm/withdrawal.test.ts` holds the entries to the rules in the README: required fields, a state for every channel, and no entry marked `DONE` while a channel is still `Open`.

## 7. Correction notice

```
What we said:     "[exact words]" on [channel], from [date] to [date].
What is accurate: [one sentence, scoped to the evidence].
What this means:  [what a reader should or should not have relied on].
What we did:      Removed on [date and time] from [channels]. [Remaining: …]
Who to ask:       [named route]
```

No "minor", "isolated", "out of an abundance of caution", or "we take X seriously". Send it by the same route as the original wherever that route is known. Anything that may touch personal data goes through counsel before it is sent.

## 8. Reinstatement

A withdrawn claim comes back only with a **new approval record** at the tier the claim needs: the exact variant, evidence, qualifier, channel, owner and expiry. **Do not restore it by reverting the withdrawal change**; that reinstates the old words with no approval.

## 9. Dry run, 2026-10-04

**What was exercised:** the search and inventory steps (§5 steps 1, 3), on a real case: the sentence "Every fact says where it came from." that PR #1208 had just withdrawn from the registers and brand documents.

**Commands.** `grep -rIn -i` for the phrase and for "where it came from" across `company-site`, `app/src`, `app/public`, `docs`, the root `*.md` files and `ops`; then text extraction and search of the 12 binary files in `app/public/decks` and `handouts`.

| Measured | Result |
| --- | --- |
| Time to **find** every instance in the repository's text files | **0.46 s** |
| Time to find in the 12 binary files (4 `.pptx`, 4 `.docx`, 4 `.pdf`) | **0.20 s**, no hits |
| Instances in public-facing files | **7**, in 3 files (log entry `2026-10-04-every-fact-says-where-it-came-from.md`) |
| Instance in an internal planning document | 1 (`gtm` messaging table; corrected in this change) |
| Time to **remove**, deploy or verify | **Not measured: no public file was edited and nothing was deployed** |

**The finding.** The withdrawal done earlier today covered the registers and the brand documents. The same unscoped sentence is **still live on the public company site, in the site's copyable templates, and on a public page in the app**. The runbook's first real use is to clear them. The log entry is `OPEN` and says so. Removal needs a decision, because the only compliant replacement is removal or a sentence that already has an approved register row, and the scoped wording (`CLM-018`) is proposed, not approved.

**Not exercised:** removal, deployment, live verification, external channels, third-party requests, escalation, a correction notice. **Time to remove from all channels is therefore still unknown.** B-39's acceptance asks for it, so B-39 is **not complete**: this is the procedure and the first measured step.

## 10. Open items

| Item | Needed from |
| --- | --- |
| A named **backup claim-owner** | Founder |
| A full run, **including deploy and live verification**, with the time recorded | Claim-owner |
| Whether a merge to `main` publishes the company site to production, and how to purge caches | Engineering |
| An **asset registry** so the sales and external rows can be exhaustive (B-38) | Brand |
| The same-day target turned into a measured number (B-40) | Operations |
| Whether any offline cache serves old in-app copy | Engineering |
