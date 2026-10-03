# Owner decisions still open: file sync, gift payments, prices, counsel

**Written 1 October 2026. This page decides nothing.** Four things on the build list are not code problems: each waits on an answer only the owner (or counsel) can give. For each, this page says what the repository does today, the realistic options, what each one unlocks, and what would change in the code once an answer is written under **Decision**. Where there is a recommendation it is marked as one.

Nothing here is marked reviewed, approved or decided. A decision, once made, goes in `docs/decisions/D-<pull request number>.md` (see `docs/decisions/README.md`), and the row below is updated to point at it.

| # | Question | Blocks | Status |
| --- | --- | --- | --- |
| 1 | Where do uploaded files live, and do they upload over a phone plan? | File submissions, course files, file sync between devices | **Open** |
| 2 | How is a gift paid, given D-146 says no money moves through Semester? | The giving half of advancement | **Open** |
| 3 | What does each package cost? | Selling anything but Free and Plus | **Open** (two prices set, the rest not) |
| 4 | Who is counsel, and what do they review first? | Every row in `COUNSEL-BRIEF.md` | **Open** (no one named) |

---

## 1. File sync and file storage

**What the repository does today.** Text is synced; files are not. D-155 (`DECISION-LOG.md`) records why: file sync needs a storage bucket with row-level security, *and* an owner decision on uploading tens of megabytes over a phone plan, "which `cloud.ts` chose not to do silently." Assignments (D-1047) take **text only** for the same reason: no file, link, media or group submission.

**Options.**

| | Option | What it means | Cost to the student or school |
| --- | --- | --- | --- |
| A | **A Supabase Storage bucket, per account, row-level security** | Files live in the project Semester already runs on; a file belongs to one account (or one school's course) and is deleted with it | Storage and egress on the Semester bill; a per-file size cap and a quota are needed |
| B | **Wi-Fi only by default** (can be combined with A) | Uploads wait for an unmetered connection unless the student chooses otherwise | None to the student; a submission with a file may be delayed |
| C | **The school's own storage, by link** | Semester stores a link and a checksum, never the file | None to Semester; depends on each school's systems |
| D | **No file storage yet** | Assignments stay text only; a student attaches a link | None; the gap stays |

**Recommendation (not a decision).** A with B on: it keeps data in the one project that already has account deletion, retention and export wired, and it never spends a student's mobile data without asking. C is the right fallback at a school that will not allow files off its systems.

**Needed from the owner.** The option; a per-file size cap; a quota per account; and whether the bucket may be in a non-default region.

**What changes once chosen.** A bucket migration with policies and a grants-audit entry; the upload path in `cloud.ts` behind a Wi-Fi check; file fields added to submissions; the privacy tables (`OWNED_TABLES`), retention and the definer register updated; account erasure extended to the bucket. A submitted file is an education record, so row I2 in the counsel brief should be answered **before** a school switches it on.

**Decision:** _not made_.

## 2. A gift payment provider versus D-146

**The disagreement.** The advancement brief names a payment provider for recurring gifts. D-146 says student accounts are kept under financial controls and **no money moves through Semester**: payments go through the school's hosted provider and are recorded by its reference, and a run of 13 to 19 digits is refused in every field. D-157 recorded that the two disagree and left neither page of the advancement site naming a provider or a figure.

**Options.**

| | Option | Consequence |
| --- | --- | --- |
| A | **Keep D-146 for gifts too** | A school's giving platform takes the money. Semester records the gift by the provider's reference, generates the school's receipts and acknowledgements, and reconciles against the provider's settlement file, as it already does for student accounts. No card data ever touches Semester. |
| B | **Reverse D-146 for advancement only** | Semester picks and integrates a processor. Counsel must first answer E1–E3 of the brief (money transmitter, PCI scope, merchant of record), and a provider must be named in writing. |
| C | **Neither yet** | Advancement stays planned; alumni relations (profile, directory, class notes) can still proceed because none of it moves money. |

**Recommendation (not a decision).** A. It is the design the student-accounts module already proves, it keeps the positioning statement ("Semester keeps the account and its controls; it does not process payments") true, and it does not wait on counsel's money-transmitter answer. B should be chosen only if a school will not run its own giving platform, and then only after E1.

**What changes once chosen.** With A: gift, pledge and campaign tables modelled on the account ledger (append-only, requester and approver apart, provider reference only). With B: a named provider, its terms in `docs/SUBPROCESSORS.md`, and the E rows answered first. With C: nothing is built for giving.

**Decision:** _not made_. Until it is, `app/src/lib/advancement/edition.ts` and both advancement pages say "planned" and name no provider.

## 3. Prices

**What is set and what is not.** Prices are in two places that must agree: `app/src/lib/plans.ts` (the app) and `company-site/index.html` (the site).

| Package | Price today | Where it is stated |
| --- | --- | --- |
| Free | **$0** | `plans.ts`, company site |
| Plus | **$7.99 a month or $59 a year**, bought in the app (checkout runs on test keys until the owner switches it live) | `plans.ts`, company site |
| Pro | "priced at launch" | company site |
| Department or programme plan | **not set** | company site says "priced separately" |
| Institution packages | **not set** | company site says "we tailor that together" |
| K–12 edition | **not set** (no district is served) | `/k12` page says no price |
| Advancement module | **not set** | `/advancement` page says "No price has been set for this module." |
| Core learning modules (assignments and the rest) | **not set** | module map says "In preparation" |
| Implementation and migration services | **not set** | company site says "priced separately, from an inventory of what moves" |

**Needed from the owner.** A number (or "stays unpriced") for each unset row, and the unit it is priced in (per student, per seat, per school, per module, flat). Fill in the table above. Counsel should review order forms and refund language before any institutional price is stated publicly.

**What changes once chosen.** The figure goes in one place per surface (`plans.ts` for the app; the company site copy, regenerated from the same data where it is generated), the "No price has been set" sentences are replaced, and the tests that forbid a stated price on a page that has none are updated in the same change. No price is entered anywhere until the owner supplies it.

**Decision:** _not made_ (only Free and Plus are set).

## 4. Counsel review

**What exists.** `docs/COUNSEL-BRIEF.md` gathers every open legal question in one place, with what the repository assumes for each. This page's changes added sections **H** (advancement and fundraising), **I** (assignments, submissions and student files) and **J** (the new site pages), so one conversation can close the questions the new work opened. The thirteen drafts under `docs/legal/` carry 77 `[DECIDE …]` lines.

**Needed from the owner.**

1. **Who.** The privacy seat is held by outside counsel per `app/src/lib/launchreadiness.ts`, and no one has signed. Name the person or firm, or ask Vanderbilt's Wond'ry about student-founder legal resources (`LAUNCH-DECISIONS.md`, item 5).
2. **What first.** The brief's own order is A1–A3 and C1, then the effective dates in D, then B1 and E1. The two new rows that gate shipped code are **H1** (charitable-solicitation registration, before any gift is taken) and **I1** (whether submissions are education records Semester may hold, before a school switches assignments on).
3. **How.** Send the brief; counsel answers in the table; each answer becomes a decision record and a named sign-off in the register.

**What this does not do.** Nothing in the repository, the registers or the site is marked "reviewed by counsel", and none will be until a named person has signed. The public claims boundary in `RELEASE-GATES.md` stands.

**Decision:** _no counsel named_.

---

## What I will do the moment an answer lands

| Answer | Change | Size |
| --- | --- | --- |
| 1 (storage) | Bucket migration, upload path, file fields on submissions, privacy and retention entries | A module of its own |
| 2 (gifts) | Giving tables and controls, or nothing, as chosen | A module of its own |
| 3 (prices) | One figure per surface and the tests that guard it | Small |
| 4 (counsel) | Record each answer, update registers and wording, never before the signature | Small, per answer |
