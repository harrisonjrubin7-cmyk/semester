> **MEMO FOR THE OWNER'S DECISION. This is not a decision, and nothing here approves a claim.** It recommends; the owner decides. Trademark and legal questions are for counsel.

# Tagline decision memo (B-12)

| Control | Value |
| --- | --- |
| Status | **Awaiting decision.** No tagline below is approved for use beyond what is already live |
| Date | 2026-10-04 |
| Decides | Harrison Rubin, claim-owner. Specialist and counsel seats are unassigned, so only the owner's tier can be exercised today |
| Candidates | T1–T6 in [`BRAND-PLATFORM.md`](BRAND-PLATFORM.md) §1.9; register rows `M-37`–`M-42` in [`BRAND-AND-MARKETING-STRATEGY.md`](gtm/BRAND-AND-MARKETING-STRATEGY.md) |
| After the decision | Write `docs/decisions/D-<pull request number>.md` (§6), per `CLAUDE.md` |

## 1. What is being decided

Which of six candidate lines Semester may use, in which audience and channel, and which to drop. A line is judged on:

1. **Claim check.** Does an approved register row, or a proposed one, support it, in the form it would appear?
2. **Evidence.** Is the thing it says true in the product today, in every place the line would be read?
3. **Consistency.** With the live site, and with decisions already taken.
4. **Plain reading.** Would a student or an administrator take it to mean one thing?
5. **Ownership.** Whether the words can be protected is a question for counsel (B-42), not for this memo; none of these is likely to be registrable on its own.

## 2. Three findings that change the options

**F1. T1 and T5 are already public.** The site's headline is "Turn your semester into one clear next step." and the status-map section says "Status is part of the product." Deciding on them is partly deciding whether to keep what is live. Evidence is in §5.

**F2. T4 contradicts the site's own copy and a decided direction.** T4 says "Beside your systems, **not instead of them**." But the live site says Semester "runs beside your systems today and **takes each one over**, a module at a time, when you are ready" (company site, "System boundaries" and the app's `more.tsx`), and [`D-1067`](decisions/D-1067.md) (decided 2026-10-01) states Semester "is intended to become the institution's LMS and gradebook of record" through a phased migration. A tagline that says "not instead of them" would be contradicted by the company's own decided plan and by the page it sits on. Separately, "takes each one over" sits close to the prohibited replacement claim (`CLM-006`); the surrounding block labels everything as not yet built, and whether that is enough is **the owner's call, not decided here**.

**F3. T2, T3 and T6 are broader than their evidence.**
- T2 ("Know where it came from") and T3 ("with sources") rest on `CLM-018`, which is **proposed, not approved**. The unscoped form of that idea ("every fact says where it came from") is the sentence the withdrawal runbook's first log entry is clearing from the public site. A tagline cannot carry the "where Semester shows a label" scope.
- T3's word "sources" can mean source labels, AI citations, or the Source Locker. Whether readers take it one way is **untested**.
- T6 ("You decide what's shared") is true of personal plans, drafts and consented sharing, which is how the site itself puts it. It is not true of official records an institution holds. `CLM-002` is conditional and Privacy has not reviewed it.

## 3. Recommendation, line by line

| # | Line | Recommendation | Why |
| --- | --- | --- | --- |
| T1 | **One clear next step.** | **Keep, as the primary student line.** | Already live, row `M-37` is Low risk, supported by `CLM-001`, describes the experience and promises no outcome. Expect no exclusivity: it is plain English |
| T5 | **Status is part of the product.** | **Keep, on trust and institutional pages only.** | Already live there. True of the site's status map and the product's status vocabulary. Not a hero line: it speaks to buyers who ask what is real |
| T4 | ~~Beside your systems, not instead of them.~~ | **Revise to "Beside your systems."** and **drop "not instead of them"** while `D-1067` stands | `CLM-004` supports "alongside … in a bounded pilot", and the qualifier must sit in the same view. The negation is what collides with F2 |
| T2 | Know what's next. Know where it came from. | **Hold; do not use site-wide.** | Blocked on `CLM-018` and on Product confirming the "institution verified" data path. At most a caption beside a screen that visibly shows a label |
| T3 | Your semester, with sources. | **Hold.** | Same blocker. Needs a quick comprehension test of "sources" before it is worth approving |
| T6 | You decide what's shared. | **Revise to "You decide what you share.", or drop.** | Scope it to personal plans and drafts. Needs Privacy review and `CLM-002`'s qualifier. Do not extend it to guardians or institutions (`M-34`) |

## 4. Options for the decision

| Option | What it is | Cost and risk |
| --- | --- | --- |
| **A. Recommended slate** | T1 primary; T5 on trust pages; T4 revised to "Beside your systems."; T2 and T3 held; T6 revised, pending Privacy | Smallest new claim surface. T4's revision needs the F2 question settled for the site's "takes each one over" sentence |
| **B. Keep only what is live** | T1 and T5; drop or hold the rest | Nothing new to approve. The institutional line stays unsettled |
| **C. Approve all six as written** | | **Not recommended.** Contradicts live copy and a decided direction (T4), and puts a universal into a tagline (T2, T3) |

**Needed from the owner:** the option, the F2 decision on "takes each one over" (a separate question, answerable independently), and whether to commission the comprehension test and the Privacy review.

## 5. Evidence

A test (`app/src/lib/gtm/taglines.test.ts`) checks that each phrase below is still in its file. If the site changes, the test fails and this memo must be revisited.

| File | Phrase |
| --- | --- |
| `company-site/index.html` | "Turn your semester into one clear next step." |
| `company-site/index.html` | "Status is part of the product." |
| `company-site/index.html` | "Takes each one over when you are ready." |
| `app/src/site/more.tsx` | "takes each one over, a module at a time, when you are ready" |
| `docs/decisions/D-1067.md` | "intended to become the institution's LMS and gradebook of record" |

## 6. Decision file, once decided

Open or reuse the pull request, then write `docs/decisions/D-<its number>.md`. Do not number it before the pull request exists.

```
## D-<PR number> · <the decision, as a sentence>

**Decided <date>.** Option <A|B|C>. Primary student line: <…>. Trust line: <…>.
Institutional line: <…>. Held: <…>. Dropped: <…>.

Why: <the findings that decided it>.
Register rows to change: <M-37…M-42, status and qualifier>.
Not done: no audience test, no trademark search, no approval of any held line.
```

## 7. What this memo did not do

- No audience research. A five-second recall or comprehension test was proposed in `BRAND-PLATFORM.md` §9.3 and **has not been run**.
- No trademark search; B-42 has not been sent to counsel.
- It did not change any public copy or any register row.
- It did not decide whether the site's "takes each one over" sentence is compatible with `CLM-006`.
