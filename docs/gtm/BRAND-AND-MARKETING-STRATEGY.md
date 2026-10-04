> **DRAFT FOR FOUNDER, COUNSEL AND SPECIALIST REVIEW. A marketing strategy, not legal advice, and not an approval of any claim, channel, audience, price or campaign. Nothing here is live until the gate it names is closed.**

# Semester brand and marketing strategy

| Control | Value |
| --- | --- |
| Status | **DRAFT — NO CAMPAIGN, CLAIM OR CHANNEL IN THIS DOCUMENT IS APPROVED** |
| Written | 2026-10-04, against `origin/main` at `7287ddc` |
| Owner | Harrison Rubin (claim-owner and legal-coordination primary, per [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md)); counsel and specialist approvers are **unassigned** |
| Bound by | [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md), [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md), [`ops/claims/README.md`](../../ops/claims/README.md), [`CAPABILITY-ACTIVATION-REGISTER.md`](../CAPABILITY-ACTIVATION-REGISTER.md), [`MARKETING-CLAIM-REVIEW-MATRIX.md`](../legal-drafts/MARKETING-CLAIM-REVIEW-MATRIX.md) |
| Next review | 2026-11-03, or on any change to the go/no-go decision, whichever is first |

**The rule that shapes everything below.** The founding thesis — every part of a student's educational life working in Semester from day one — is a *product direction*. It is maturity level L0 in the [capability register](../CAPABILITY-ACTIVATION-REGISTER.md), and the audit this was commissioned from says so itself: "no feature may be marketed as available before" it is Core Live or Controlled Automation. The public site's own register currently holds **zero** claims at "Available now" ([`ops/claims/README.md`](../../ops/claims/README.md)). So the brand can carry the ambition; it may not carry the ambition *as a capability*. Where the two meet, this document says which wins.

---

## 0. What main already holds, and what this adds

[`CLAUDE.md`](../../CLAUDE.md) says to check main for the thing before writing it. Checked, with `git log` and the file tree, on 2026-10-04. The market-readiness package landed on 2026-10-03 (`545010c`), one day before this. It covers more than the request implies, so this document **links to it rather than restating it**.

| # | Requested deliverable | Already on main | Gap this document closes |
| --- | --- | --- | --- |
| 1 | Brand strategy | Design principles in [`DESIGN-SYSTEM-GUIDE.md`](../../DESIGN-SYSTEM-GUIDE.md); one-sentence positioning in [`GO-TO-MARKET-POSITIONING.md`](../market-readiness/GO-TO-MARKET-POSITIONING.md) | Purpose, narrative, voice, values, promise, differentiation (§1) |
| 2 | Messaging architecture | [`MESSAGING-HOUSE.md`](../market-readiness/MESSAGING-HOUSE.md), [`BUYER-PERSONAS.md`](../market-readiness/BUYER-PERSONAS.md), [`BUYER-ONE-PAGERS.md`](../market-readiness/BUYER-ONE-PAGERS.md) — all institutional | Students, families, alumni, employers, partners; one matrix with proof allowed and forbidden per audience (§2) |
| 3 | Visual identity | Graphite/Brass system, three-slab mark, 12 local fonts, contrast ramp test, [`COMPANY_SITE_BRAND_ALIGNMENT_2026-10-01.md`](../COMPANY_SITE_BRAND_ALIGNMENT_2026-10-01.md) | Marketing-surface requirements: social, video, email, print, ambassador, ads (§3) |
| 4 | Website and trust center | `company-site/` (116 sitemap URLs), [`TRUST-CENTER-CONTENT.md`](../market-readiness/TRUST-CENTER-CONTENT.md), trust room | Audience paths, page briefs, conversion flows, and what the public tier may show (§4) |
| 5 | Launch, demand, calendar, social, PR, community, lifecycle | [`social.ts`](../../app/src/lib/gtm/social.ts) pillars, platforms and funnels; [`CONTENT-AND-CHANNEL-PLAN.md`](../market-readiness/CONTENT-AND-CHANNEL-PLAN.md); [`EMAIL-LIFECYCLE.md`](../market-readiness/EMAIL-LIFECYCLE.md) (7 lines); [`CAMPUS-LAUNCH-KIT.md`](../market-readiness/CAMPUS-LAUNCH-KIT.md) (5 lines) | A gated launch sequence, a 12-week calendar, PR, community stance, a full lifecycle table (§5) |
| 6 | Growth loops, referral, ambassadors, retention | [`INDIVIDUAL-GROWTH-STRATEGY.md`](../market-readiness/INDIVIDUAL-GROWTH-STRATEGY.md), [`STUDENT-AMBASSADOR-PLAYBOOK.md`](../market-readiness/STUDENT-AMBASSADOR-PLAYBOOK.md), [`REFERRAL-AND-SHARING-SAFETY.md`](../market-readiness/REFERRAL-AND-SHARING-SAFETY.md), `referral_codes`/`referrals` tables | Named loops built on features that exist; the referral reward decision; ambassador counsel questions (§6) |
| 7 | Marketing operations | **Code:** `campaign.ts` `activationGate`, `messaging.ts`, `utm.ts`, `kpi.ts`, `sponsor.ts`, and `gtm_*` tables ([`docs/gtm/EXECUTION-PLAN.md`](EXECUTION-PLAN.md)); [`MARKETING-COMMUNICATIONS-CONSENT-DRAFT.md`](../legal-drafts/MARKETING-COMMUNICATIONS-CONSENT-DRAFT.md) | A runbook over that code: QA checklist, suppression, review SLAs, lead-scoring rules (§7) |
| 8 | Public claims register | [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) (CLM-001–017, topic-level) and the data-driven site register in `ops/claims.ts` | A **copy-level** register: exact words, evidence, owner, review date, risk (§8) |
| 9 | Competitive and category | [`COMPETITION.md`](../../COMPETITION.md), [`COMPETITIVE-REVIEW.md`](../../COMPETITIVE-REVIEW.md), [`MARKET-POSITION.md`](../../MARKET-POSITION.md) — internal, feature-level | Public-safe positioning and the category narrative (§9) |
| 10 | Metrics | [`METRIC-DICTIONARY.md`](../market-readiness/METRIC-DICTIONARY.md), [`METRICS-AND-ANALYTICS-PLAN.md`](../market-readiness/METRICS-AND-ANALYTICS-PLAN.md), [`EVENT-TAXONOMY.md`](../market-readiness/EVENT-TAXONOMY.md), `kpi.ts` | **Awareness, CAC and brand trust** are absent; added with definitions (§10) |

Nothing here duplicates a figure, a price or a decision that is already argued elsewhere. Where a number is needed and none is approved, the cell says `[SET AFTER BASELINE]`.

---

## 0.1 Findings that change the plan

These came from reading the sources against each other and, where possible, the code. Each was re-checked against main before being fixed; F1, F3, F4 and F7 turned out narrower than first written, and the rows say so. **Fixed in this PR:** F1, F2, F5, F8. **Not a code fix:** F3 (needs a production check), F4 and F7 (no change needed), F6 (founder and counsel).

| # | Finding | Evidence | What to do |
| --- | --- | --- | --- |
| F1 | **The positioning doc leads with a "paid pilot" without carrying the RED gate.** *Fixed in this PR.* | The market-readiness package consistently marks paid pilots RED ([`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md), `EXECUTIVE-GO-NO-GO.md`, the readiness baseline). Only [`GO-TO-MARKET-POSITIONING.md`](../market-readiness/GO-TO-MARKET-POSITIONING.md) and [`PRICING-AND-PACKAGING.md`](../market-readiness/PRICING-AND-PACKAGING.md) describe the offer with no inline status. The public site does not say "paid pilot". | Both docs now open with a status line: target offer, NO-GO/RED, not for public copy. An earlier draft of this row called it a conflict between documents; it is a missing label. |
| F2 | **The pricing page printed a savings figure the catalog prices do not give. Fixed in this PR.** | `company-site/index.html` said "Annual · save 37%"; $7.99 × 12 = $95.88 and $59 is 38.5% below that. The prices themselves are **decided**: D-134 (owner, 29 Sep 2026) set Plus at $7.99 a month or $59 a year "everywhere", and `plans.test.ts` holds the page to the catalog. | The label is now "save 38%" (rounded down: a saving may be understated, never overstated) and `companysitepricing.test.ts` holds it to `plans.ts`; it failed on 37 before the fix. **Still open:** CLM-015 and [`PRICING-AND-PACKAGING.md`](../market-readiness/PRICING-AND-PACKAGING.md) mark price and savings `[PRICE TO BE CONFIRMED]` / prohibited, and [`MARKET-POSITION.md`](../../MARKET-POSITION.md) §13 still lists a $72/yr figure. Those documents and D-134 disagree; the founder reconciles them. An earlier draft of this row recommended removing the prices, which would have reversed D-134 and was withdrawn. |
| F3 | **The hero button says "Start planning free"; the beta is invite-gated. The gate exists in code; whether it is switched on in production is unverified.** | `supabase/migrations/20260921002428_invites.sql` enforces invite-only at the database, and `lib/invite.ts` explains a refusal to the person. The migration ships with the switch **off** (`set_invite_only(true)` starts the pilot). The site banner already says sign-up "may ask for an invite", and the app can be used locally without an account. | No copy change. Founder/Engineering to confirm the production switch matches the go/no-go (invitation-only) before G1; until then "Request an invite" is the safer button. An earlier draft called the signup "open", which the code does not support. |
| F4 | **"Student OS" is not on the public site; the risk is prospective.** | A search of `company-site/` finds no "Student OS" or category use of "operating system" (one hit is a browser-requirements table). The audit thesis and CLM-006 are the reason to keep it that way. | No site change. Rule stands: keep it off public pages (D1). |
| F5 | **"Unlimited courses and syllabi" on the Free plan, when reading a syllabus uses a metered AI call.** *Fixed in this PR.* | `supabase/functions/claude/index.ts:45`: shared key capped at 60 calls per account per month by default. The app's own `allowance.test.ts` already forbids "unlimited" next to AI because "courses are unlimited; generations are not". | The pricing page now says "Unlimited courses. Reading a syllabus uses AI, which has a monthly limit per account", and the Free-vs-Plus terms row says the same. The number is not published (it is an environment variable). |
| F6 | **"We don't sell student data" is already published, and its legal footing is not in place.** | Public in five places: `company-site/index.html` (~lines 521, 709, 2984) and `site.js` (~lines 660, 738). `ops/claims` `student-terms`: drafts only, nothing in force, no legal entity. | **Not fixed here, deliberately.** Removing or softening a commitment the owner chose to publish, or asserting a legal position, is a founder and counsel decision. Counsel to confirm the sentence can stand, or it comes down (M-17). |
| F7 | **"90-second walkthrough" is a six-screen click-through, not a video.** | `company-site/index.html` "experience" page: six captured screens of the fictional-data demo, each with alt text and a caption. The "90-second" is an estimate. | No change needed: it is labelled as a walkthrough of screenshots and the demo data is labelled. Do not describe it as a video, and do not repeat "90-second" as a measured figure. Both the home test and the screenshot test pin the current wording. |
| F8 | **The site claim register overstated the automated accessibility scan.** *Fixed in this PR.* | `ops/claims` `a11y-app` said "Every screen … over every route". `app/src/a11y/axe.test.tsx` covers twelve screens at desktop width and three at phone width, in jsdom, which cannot check colour contrast or layout. CLM-007's "six-route/local" refers to a different thing: the bounded browser checks in the responsive QA plan. They are two evidences, not one scope. | The claim now says "the main student screens", with the twelve/three scope and the jsdom limit; `ops/claims/README.md` is regenerated with `npm run registers`. M-15 must name both scopes separately. |

---

## 1. Brand strategy

### 1.1 Category and positioning

**Category.** *Student action platform.* It is already the title of the company site, it is true of what exists, and it does not imply anything is replaced. It names the job — turning scattered information into the next step — rather than a system class.

**Positioning statement (internal).**
For a student who is holding a term together across a syllabus PDF, a portal, a calendar, an inbox and an advisor, Semester is the student-held place where those become one plan and one next step. Unlike a learning management system, it is not the school's record. Unlike a generic planner, it reads what the school actually issues. Unlike an AI answer engine, it shows where every fact came from and does nothing until the student presses the button.

**Public one-liner (candidate, for claim review).** *One place for your semester — and a clear next step.*

**Two-sentence version.** Semester brings your plan, deadlines, study and support into one place, and tells you where each fact came from. It sits beside the systems your school already runs; it does not replace them.

### 1.2 Purpose

Make the semester legible, so a student can act on what matters next. Not "disrupt education". Not "replace the stack". Legibility is the purpose because it is what every shipped behavior serves: source labels, Today, the editable plan, check-before-keep on syllabus dates, export and delete.

### 1.3 Narrative

| Beat | Line | Must be true because |
| --- | --- | --- |
| The scatter | A semester arrives in pieces: a syllabus, a portal, an email, a calendar, a conversation. | Observable; make no prevalence statistic |
| The cost | The work of assembling it falls on the student, every term, alone. | Framing, not a measured claim |
| The turn | What if the assembling was done once, shown honestly, and left in your hands? | Brand statement |
| The proof | Upload a syllabus; check the dates; keep what's right. Every fact says where it came from. | M-02, M-09 — only inside the beta |
| The limit | It does not submit anything to your school or change a record. It can be wrong; you check. | M-08; [`KNOWN-LIMITATIONS.md`](../launch/KNOWN-LIMITATIONS.md) |
| The invitation | We are in a private beta. Ask for an invite. | CLM-003 |

The ambition — *eventually, more of a student's life, family, career, alumni years* — appears only as a separate, plainly labelled "where this is going" block, with no dates (CLM-017).

### 1.4 Voice

Taken from the design guide's "direct, source-aware language" and from the tone of the shipped screens and scripts.

| Trait | Means | Do | Don't |
| --- | --- | --- | --- |
| **Plain** | Short sentences, school words | "Check each date before you keep it." | "Leverage AI-powered insights to optimize outcomes." |
| **Calm** | No urgency manufactured | "Here is what is due next." | "Don't miss out!" "Only 50 spots!" |
| **Source-aware** | Says where a fact came from, and where it is weak | "From your syllabus. A syllabus can be wrong." | "Always accurate." |
| **Bounded** | States the limit beside the claim | "Private beta. Not connected to your school's systems unless your school turns that on." | Footnote-sized caveats |
| **Student-held** | The student is the subject | "You can take it with you, or delete it." | "We manage your data journey." |

Readability: write student copy to a lower-secondary reading level and test it; institutional copy may be denser but never uses a term the school's own catalogue does not.

### 1.5 Values, as behaviors

| Value | The behavior that proves it | Where it is already enforced |
| --- | --- | --- |
| Action before inventory | Lead with the next safe action | Design guide principle 1 |
| Say where it came from | Imported / official / student-entered / estimated / AI-derived stay distinguishable | Design guide principle 2; `source.test.ts` |
| The student holds the keys | Export, delete, revoke; AI runs on press | `export.ts`, `erase.ts`, share expiry/revoke |
| Failure is designed | Last saved plan stays visible; the official route is offered | Capability fallbacks in the register |
| Claim less than we built | Public words never outrun the register | `ops/claims` test refuses an overclaim |

### 1.6 Brand promise

> **We show you where it came from, we never act for you without asking, and it is yours to take with you.**

Three promises, each falsifiable by a student in ten minutes, each mapped to a claim row (M-09, M-05/M-08, M-07). A promise that cannot be tested by the student is not a brand promise here; it is a claim, and goes to §8.

### 1.7 Differentiation

| Difference | Proof it is real today | Status word it may carry | Do not say |
| --- | --- | --- | --- |
| Shows the source of every fact | `source.test.ts`; Trust & data screen | In preparation | "Always correct" |
| Works across any LMS without a school agreement, by a calendar link the student already has | `feedlink.ts`; [`COMPETITION.md`](../../COMPETITION.md) item 5 | In preparation | "Integrates with Canvas/Brightspace" (CLM-005) |
| Local-first; works without an account | Script; [`KNOWN-LIMITATIONS.md`](../launch/KNOWN-LIMITATIONS.md) | In preparation | "Works fully offline" |
| No third-party analytics, no ad SDK in the app | Script; observability decision in [`SEMESTER_MARKET_READINESS.md`](../../SEMESTER_MARKET_READINESS.md) | In preparation | "Zero tracking" (the site is unverified) |
| Aggregates only, with a floor of ten, and a refusal list (no risk scores, no attention tracking) | `institution-ops.ts` `FORBIDDEN`; `cohortfloor.test.ts` | Planned for institutions | "We never collect…" as a blanket |
| Says what it does not do yet | [`KNOWN-LIMITATIONS.md`](../launch/KNOWN-LIMITATIONS.md); Trust Center | — | — |

---

## 2. Messaging architecture

One matrix. **Allowed proof** means evidence that exists on main today; it does not mean a claim is approved — approval is §8. **Motion** is what the go/no-go permits.

| Audience | Their real question | Core message | Allowed proof today | Never | Motion / CTA | Claims |
| --- | --- | --- | --- | --- | --- | --- |
| **Students** | Will this save me time, or become another thing to maintain? Is it safe? | "Upload your syllabus, check the dates, keep what's right. See what's due next." | Syllabus check-before-keep; Today; calendar; study tools; export/delete; local-first | Outcome promises (grades, hours saved); "free forever"; "unlimited AI" | Request an invite → unpaid beta (conditional) | M-01–M-10 |
| **Families and guardians** | Will it show me my student's grades? Is my student being watched? | "Semester is the student's own tool. Nothing is shared with anyone unless they choose it, and they can stop." | Share scope/expiry/revoke exist; family access is **not** inferred | Any family record access or "parent portal available"; fear-based copy | **Listening only.** Family capability is high-risk class and not live. No capture until a consent system operates | M-34 |
| **Faculty and advisors** | Does this add work, or undermine my course? | "Students arrive with a clearer plan and better questions. You stay the authority." | Advisor shared view; Course Studio exists but is on for no institution | "Replaces advising"; any grade or risk claim | Peer demo on synthetic data; quick-start | M-22, M-23 |
| **Administrators (student success, advising, first-year, registrar-adjacent)** | Is it safe, measurable and reversible? Will it be another dashboard that watches students? | "One bounded cohort, manual or approved read-only data, named owners, a decision date, a clean exit." | Pilot rules in code (26 weeks, baseline, midpoint review); n≥10 floor; refusal list | "Improves retention"; "paid pilot" (F1); a customer name | Design-partner discovery; synthetic demo | M-21–M-24 |
| **IT and security** | What data goes where, who can touch it, and what has been independently tested? | "Additive, least-privilege, tenant-scoped, auditable, and honest about what is not yet assured." | Control matrix, data-flow map, subprocessor register, CI gates — each with its gap stated | "Secure", "encrypted", "pen tested", "SOC 2", "FERPA compliant" (CLM-010) | Trust Center → trust room under NDA | M-27 |
| **Procurement and legal** | Is there paper, insurance, a DPA, an accessibility report? | "Drafts and issue lists exist for counsel; none is executed." | [`docs/legal-drafts/`](../legal-drafts), HECVAT evidence index | Any statement that a policy or agreement is in force | Hand over via trust room; accept disqualification honestly ([`OBJECTION-HANDLING.md`](../market-readiness/OBJECTION-HANDLING.md)) | M-27 |
| **Alumni** | Will I keep my records and network after I leave? | "Your semester is portable: take your data with you." | Export (`export.ts`) | Alumni network, credential wallet, mentoring — all **Planned** (`ops/claims` rows) | Roadmap statement only; no list capture | M-35 |
| **Employers** | Can I find verified talent? | None yet. | None — marketplace and credentials are not built | "Verified talent", "marketplace" | **Do not market.** Log inbound interest by hand | M-35 |
| **Partners** (campus organizations, advisors' offices, ed-tech and LMS vendors, community partners) | What is the arrangement and who owns the student relationship? | "A student-held layer that is additive. We will not imply your endorsement." | LTI direction is a 1EdTech standard needing a school administrator, no partner programme ([`MARKET-POSITION.md`](../../MARKET-POSITION.md) §14) | Logos, endorsements, "partnered with" (CLM-013) | Written scope first; partner directory is empty and says so | M-24, M-30 |

**Handling a refusal.** When the honest answer is "we don't have that yet", say so, offer the lowest-risk path, and let the buyer decide. [`OBJECTION-HANDLING.md`](../market-readiness/OBJECTION-HANDLING.md) already sets this posture; this section only extends it to audiences that file lacks.

---

## 3. Visual identity and brand-system requirements

**No second visual vocabulary.** The identity exists: near-black, graphite, silver and brass; the serif/condensed/sans pairing (Cinzel for display titles, Barlow Condensed for utility headings, Barlow for reading); the three-slab mark; 12 local font files under the SIL Open Font License. Brass is a focus and action signal, not decoration. This section adds only what marketing surfaces need.

### 3.1 Requirements that apply to every marketing asset

| Area | Requirement | Held by |
| --- | --- | --- |
| Contrast | Text and non-text meet WCAG 2.2 AA against **every** surface the asset can sit on, not the flattering one. Faded text is measured on the panel it sits on | `lib/contrast.test.ts` walks the ramp; [`CLAUDE.md`](../../CLAUDE.md) explains why |
| Colour | Never the only signal. A status chip carries a word and an icon | Design guide |
| Type | Reading text in Barlow; body measure 58–72 characters on wide screens; minimum body size is set by the channel's accessibility default, not by the layout | Design guide |
| Targets | 44px minimum touch targets on web assets; visible focus indicator | `COMPANY_SITE_BRAND_ALIGNMENT` |
| Reflow | Usable at 320 CSS px and 200% zoom, no horizontal page scroll | Company-site review (118 routes) |
| Motion | No autoplay with sound; respect reduced motion; nothing flashes | `app/src/a11y/` motion module |
| Video | Human-checked captions, a transcript beside it, no music under speech, audio description where the visuals carry meaning | [`WHAT-IS-SEMESTER.md`](../launch/WHAT-IS-SEMESTER.md) |
| Images | Alt text written for the point, not the pixels; no text baked into images unless it is also in the alt/caption | — |
| Product imagery | Always labelled "Illustration — demo data". Synthetic data only. No real student, no real syllabus, no real school's name | Existing hero label |
| People | No stock "students" presented as users or testimonial. Real students only with a signed, claim-specific permission (CLM-013) | [`STUDENT-AMBASSADOR-PLAYBOOK.md`](../market-readiness/STUDENT-AMBASSADOR-PLAYBOOK.md) |
| Status chips | Marketing assets that mention a capability carry its register word: Available now / Limited beta / Institution-configured / Built and tested, not yet deployed / In preparation / Planned | `ops/claims.ts` `STATUS_LABEL` |
| Disclosure | Qualifiers sit beside the claim, in the same text size class, and are reachable by keyboard and screen reader | [`MARKETING-CLAIM-REVIEW-MATRIX.md`](../legal-drafts/MARKETING-CLAIM-REVIEW-MATRIX.md) |

### 3.2 Per-channel template requirements

| Channel | Template rules |
| --- | --- |
| Short video (Instagram, TikTok, Shorts) | On-screen captions burned in **and** a caption file; one planning action per video; end card with the status word and the invite CTA; no countdown, no "last chance" |
| Social static / carousel | One idea per card; text in the post body as well as the image; alt text on every image; no claim exists only in an image |
| Email | Plain-text part always; one-click unsubscribe on marketing mail; no grades, task titles or health information in subject lines ([`EMAIL-LIFECYCLE.md`](../market-readiness/EMAIL-LIFECYCLE.md)); links use the UTM convention only |
| Print and QR | QR carries a campaign code only (`campaignUrl`); printed URL beside it; no data in the code; contrast-checked in print colour |
| Slides and webinars | Captions live; deck shared in an accessible format; synthetic data only |
| Ambassador kit | Approved one-sentence description, status word, official-record disclaimer, known limitations, withdrawal/export/delete path ([`CAMPUS-LAUNCH-KIT.md`](../market-readiness/CAMPUS-LAUNCH-KIT.md)) |
| Paid media | **Not permitted** — individual paid acquisition is held (go/no-go). Any later contextual-only placement follows [`ADVERTISING-AND-MONETIZATION-POLICY.md`](../market-readiness/ADVERTISING-AND-MONETIZATION-POLICY.md) |

### 3.3 Asset QA (run before every publish)

1. Contrast measured on each ground the asset can appear on.
2. Keyboard and screen-reader pass on any interactive asset; 320 px and 200% zoom pass.
3. Captions checked by a person; transcript present.
4. Every claim in the asset has a §8 row, in date, with the right status word beside it.
5. Illustration labelled; no real person's data.
6. Source, owner, review expiry recorded on the asset.

**Visual guidance is not evidence of accessibility conformance.** No ACR or VPAT exists and no qualified manual review has been completed (CLM-008). Nothing in this section may be turned into "accessible" or "WCAG compliant" on a public surface.

---

## 4. Website, information architecture and trust center

### 4.1 Principle

Do not rebuild the site. The company site already carries 116 sitemap URLs and passed a 118-route browser review at 320 px and 1440 px. The work is **audience routing** and **truth at the point of claim**: every page says who it is for, what is built, what is not, and what to do next.

### 4.2 Information architecture

```
Home ─────────────── who is this for? (Student · Institution · Reviewer)
├─ Students
│    ├─ How it works (syllabus → check → keep → Today)
│    ├─ Use-case pages (registration · first week · workload · deadlines)
│    ├─ Free tools (registration checklist, study-plan template)
│    └─ Request an invite
├─ Institutions
│    ├─ Design-partner pilot (what it is · what it is not · gates)
│    ├─ For advisors and student success · For faculty
│    ├─ Demo (synthetic) · Pilot overview
│    └─ Contact → discovery
├─ Trust Center  (see 4.5)
├─ Availability  (every capability + its status word)
├─ Pricing       (see F2: D-134 prices, labelled planned)
├─ Resources · Community (honest "not switched on") · Founder's letter
└─ Status · Contact · Legal
```

**Rule for the navigation:** the primary navigation never contains a capability whose register word is "Planned". Planned items live on **Availability** and nowhere louder.

### 4.3 Page briefs

Each brief: job, audience, one primary action, required claims (§8), required qualifiers, must-not-contain.

| Page | Job | Primary action | Claims | Must not contain |
| --- | --- | --- | --- | --- |
| Home | Orient in five seconds; route by audience | Request an invite / See how it works | M-01, M-12, M-22 | Student counts, logos, ratings |
| How it works | Show syllabus → check → keep → Today with a labelled illustration | Request an invite | M-02, M-09 | A claim that dates are always right |
| Use-case pages ×4 | Answer one question a student searches; end in a free tool, then an invite | Download the tool | M-01, M-09 | Outcome promises; urgency |
| Students: privacy | Plain-language data page: what is stored, where, how to export and delete | Read the full notice | M-03, M-05–M-07 | "Secure"; "we never…" blanket |
| Institutions | State the offer and its limits | Start a discovery conversation | M-21–M-23 | "Paid pilot"; "replaces"; "enterprise-ready" |
| Pilot overview | The pilot's structure and its gates | Contact | M-21 | Dates; a price |
| Demo | Synthetic walk-through, captioned | Contact | M-22 | Real data; a school's name |
| Trust Center | See 4.5 | Request the trust room | M-15–M-20, M-27 | Any certification |
| Availability | One row per capability with its status word | — | all status words | A capability above its register word |
| Pricing | Keep the D-134 prices, each marked planned and not on sale | Request an invite | M-13, M-14 | "Save N%" not matching the catalog; any "buy" button |
| Request an invite | Collect the minimum, with unbundled optional marketing consent | Submit | consent text (§7.2) | A pre-checked box |
| Community | Say plainly nothing is running; offer the ambassador interest form only when the programme is open | — | M-36 | A "join our community" implying one exists |
| Founder's letter | Honest origin; what is built and not | Request an invite | M-12 | A university's name as endorsement (see 5.5) |
| Status | Where Semester is up | — | M-32 | Uptime figures |

### 4.4 Conversion flows

**Student (invitation-only, unpaid, until F3 is resolved).**
`use-case page or social post → free tool → "Request an invite" (minimum fields; unbundled optional marketing consent) → invitation, sent only when a cohort has capacity → account / local start → syllabus check → first plan → Today`
Measured at each arrow with the events in [`EVENT-TAXONOMY.md`](../market-readiness/EVENT-TAXONOMY.md). Never score the person (§7.4); queue by cohort capacity.

**Institution (non-activation discovery only).**
`LinkedIn or referral → /institutions → synthetic demo → discovery call (scorecard 0–20) → trust review via trust room (NDA first) → written scope → [decision: design-partner pilot, if and when the go/no-go allows]`
Stage gates are `SALES_EXIT` in `stages.ts`. Marketing cannot move a stage; it can only produce evidence the stage asks for.

### 4.5 Trust Center positioning

**Posture: show the work, name the gaps.** For a buyer who has seen five vendors overclaim, an honest gap list is the differentiator. The Trust Center is a *claims-and-evidence index*, not a badge wall.

| Tier | Content | Audience |
| --- | --- | --- |
| **Public** | Capability list with status words; known limitations; AI use and disclosure; data ethics (what is measured, what is never measured, the n≥10 floor); subprocessor list (once approved); accessibility **roadmap** and self-assessment, stated as not a conformance report; incident and status approach; how to request the trust room | Everyone |
| **NDA (trust room)** | Security control matrix, HECVAT evidence index, data-flow map, pilot paper drafts, accessibility self-assessment | A named reviewer, with an expiring link; every open logged |
| **Never public** | Anything that would read as a certification: SOC 2, ISO, pen-test results (none exist), an ACR (none exists) | — |

A section titled **"Not yet in place"** lists, in plain words, what the [`TRUST-CENTER-CONTENT.md`](../market-readiness/TRUST-CENTER-CONTENT.md) index already admits: no independent security assessment, no ACR/VPAT, no executed DPA or pilot agreement, no insurance evidence, no restore of the production database ever performed, no public multi-service status operation. This is the page a CISO will quote back to a colleague. It is also exactly what CLM-009/010 permit.

---

## 5. Launch, demand generation, content, social, PR, community, lifecycle

### 5.1 The launch is a sequence of gates, not a date

The go/no-go decides what marketing may do. There is no "launch day".

| Gate | Opens when | Marketing may | Marketing may not |
| --- | --- | --- | --- |
| **G0 — Preparation** (now) | Always | Build the claim library, assets, trust center, owned content; talk to design-partner prospects under non-activation rules; request-an-invite list | Send marketing email or SMS (no approved sender or suppression); name any customer; run paid media; publish a "launch" |
| **G1 — Invitation-only unpaid validation** | The eight conditions in the go/no-go for individual acquisition close for **one named cohort** (exact-SHA gates, counsel-approved terms and public policy, representative-user UAT, accessibility review, staffed support, outcomes and stop criteria) | Invite that cohort; run ambassador workshops (if the programme is approved); publish captioned demos with beta labels | Open signup; broad promotion; testimonials without permission |
| **G2 — Design-partner pilot** | A signed GO for one bounded pilot, approved paper and an activation decision | Describe the pilot's existence **only as the partner permits, in the words they approve** | A customer claim or logo before CLM-013 permission |
| **G3 — Paid pilot / broad** | The profile conversions in the go/no-go | Out of scope here. Re-plan | Everything |

If evidence expires or a new material finding appears, the affected gate **closes again** and the claims that depended on it come down (§8.3).

### 5.2 Launch campaign: "One clear next step"

Borrowed from the site's own hero, so it is already true to the product and already reviewed.

| Element | G1 content |
| --- | --- |
| Idea | Your term arrives in pieces. Here is one place that puts it together and tells you the next step. |
| Hook formats | "Upload a syllabus. Check the dates. Keep what's right." / "Where did this deadline come from?" |
| Proof | A captioned 60–90 second demo on synthetic data (script exists); the Availability page |
| CTA | Request an invite |
| Qualifier | "Private beta. Dates come from your syllabus; check them." always on screen |
| Not | Countdown, scarcity, "join thousands", comparisons to named competitors |

### 5.3 Demand generation

**Individual.** No paid acquisition. Owned and earned only: search/use-case pages, free tools, short-form demos, advisor and organization referrals, orientation workshops. The first-1,000 plan ([`FIRST-1,000-STUDENTS-ADOPTION-PLAN.md`](../market-readiness/FIRST-1,000-STUDENTS-ADOPTION-PLAN.md)) governs pacing: **pause the channel that fails its guardrails even if sign-ups grow.**

**Institutional.** Narrow and specific. The ideal-customer profile and the qualification scorecard already exist ([`IDEAL-CUSTOMER-PROFILE.md`](../market-readiness/IDEAL-CUSTOMER-PROFILE.md), [`SALES-QUALIFICATION-SCORECARD.md`](../market-readiness/SALES-QUALIFICATION-SCORECARD.md)). Marketing's job is to make those buyers' first search find an honest answer:

- LinkedIn essays on fragmentation, source labels, accessibility and AI boundaries — the "institutional insight" and "responsible technology" pillars in `social.ts`.
- A "what Semester is not" page that pre-qualifies out the buyers the scorecard disqualifies (SIS write required, certificate required, individual risk scoring wanted).
- Warm paths only for the first ten accounts. [`FIRST-10-INSTITUTIONS-TARGETING-PLAN.md`](../market-readiness/FIRST-10-INSTITUTIONS-TARGETING-PLAN.md): "do not fabricate relationships".
- No cold bulk email. Institution-provided contact details are not marketing permission (consent draft), and a contact record holds a role and a work address only.

### 5.4 Twelve-week content calendar (G0 → G1 preparation)

Starts 2026-10-05. Academic anchors are generic (midterms, registration windows, finals, syllabus week); **do not assert any one school's dates.** Every asset needs a §8 row, captions, alt text, an owner and an expiry before it publishes. Publishing is **manual**: the plan's own rule is no direct platform publishing for social ([`EXECUTION-PLAN.md`](EXECUTION-PLAN.md) item 4).

| Wk | Starts | Student theme | Pillar (`social.ts`) | Assets | Institutional / trust track | Claims | Gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Oct 5 | Midterms: what's actually due | clarity | Use-case page "this week's deadlines"; 1 short demo script | LinkedIn: "The semester arrives in pieces" | M-01, M-09 | G0 |
| 2 | Oct 12 | Check before you keep | planning | Captioned demo of syllabus check | Trust Center "Not yet in place" draft | M-02, M-09 | G0 |
| 3 | Oct 19 | Registration prep | planning | Registration checklist tool refresh; carousel | Pilot overview page review | M-21 | G0 |
| 4 | Oct 26 | Where did this come from? | responsible | Source-label explainer (video + transcript) | Essay: "Source labels, not black boxes" | M-09 | G0 |
| 5 | Nov 2 | Study plan for finals | study | Study-plan template | Accessibility roadmap page (no conformance) | M-15 | G0 |
| 6 | Nov 9 | Advisor meeting prep | planning | "Bring a Path Snapshot" guide | Advisor one-pager (synthetic) | M-22 | G0 |
| 7 | Nov 16 | Take it with you | responsible | Export/delete walk-through | Essay: "What we measure, and what we refuse to" | M-07, M-19 | G0 |
| 8 | Nov 23 | Break-week reset | clarity | One short, optional-reading post | Quiet week; QA the claim register | — | G0 |
| 9 | Nov 30 | Finals runway | study | Exam-runway demo | Founder's letter review | M-12 | G0 |
| 10 | Dec 7 | When you're behind | clarity | "Recovery plan" demo (student-controlled; no prediction) | Counsel questions list (§7.6) | — | G0 |
| 11 | Dec 14 | Term wrap | stories | **Only** if a permissioned story exists; else a "what I'd tell a first-year" ambassador-free post by the founder | Year-end trust review | M-12 | G0 |
| 12 | Dec 21 | Spring syllabus week prep | planning | "Syllabus week checklist" | Readiness review: which G1 conditions are closed | — | G0→G1? |

Platform roles are those already in [`social.ts`](../../app/src/lib/gtm/social.ts) (Instagram, TikTok, LinkedIn, YouTube, Facebook, email, in-app). Cadence is the existing plan's: 2–3 short videos a week only during campaigns; 2 use-case pages a month; webinar monthly; LinkedIn/email weekly or biweekly.

### 5.5 PR strategy

There is no news yet, and inventing some is the failure mode. Plan accordingly.

| Phase | Posture | Actions |
| --- | --- | --- |
| G0 | **No launch announcement.** Earned credibility through ideas, not availability | Founder bylines on fragmentation, source labels and responsible AI in higher education; student-newspaper and campus-publication op-eds; respond to reporters' questions on student tools with no product pitch |
| G1 | Small, accurate | A short post that the invitation-only beta has opened for a named cohort, in the cohort's words if the institution approves |
| G2 | Partner-led | Any announcement is the partner's, in words they approve, with their logo only by written permission |

**Spokesperson rules.** One spokesperson at first (the founder). Every on-record sentence is checked against §8. "I don't know yet" is acceptable.

**Founder story caution (counsel).** The founder is a student at a named university. That fact is true and is also the sentence most likely to be read as endorsement. [`MESSAGING-HOUSE.md`](../market-readiness/MESSAGING-HOUSE.md) already prohibits "Vanderbilt-approved/partnered". Whether and how to state the affiliation — and whether the university's policies on student ventures or its marks bear on it — is a counsel and university-policy question, not a copy question. Default until answered: do not name the university in public materials.

**Corrections.** If any outlet misreports a capability, send a correction request the same day and log it as a claims incident (§8.3).

**Pitch angles that are true today:** a student-built tool that cites its sources; "what a student-data refusal list looks like"; why a student planner should say what it cannot do.

### 5.6 Community strategy

The five community pages exist and each says no programme is switched on for any campus, no ambassador recruited, no story published, no partner listed and no event scheduled ([`CHANGELOG.md`](../../CHANGELOG.md)). That honesty is an asset. Keep it.

1. **Do not build a social network.** The pages already say so.
2. **Start with workshops, not a platform:** the 10-minute "plan your first week" session ([`CAMPUS-LAUNCH-KIT.md`](../market-readiness/CAMPUS-LAUNCH-KIT.md)), run by the founder and, later, approved ambassadors.
3. **No user-generated content until moderation operates.** [`CAMPUS-MODERATION-SOP.md`](../CAMPUS-MODERATION-SOP.md) and [`COMMUNITY-GUIDELINES-DRAFT.md`](../legal-drafts/COMMUNITY-GUIDELINES-DRAFT.md) exist as drafts.
4. **Stories only with claim-specific written permission** for the exact words, image and channel (CLM-013), revocable.

### 5.7 Lifecycle messaging

Extends the 7-line [`EMAIL-LIFECYCLE.md`](../market-readiness/EMAIL-LIFECYCLE.md). **Nothing below sends until a sender, a vendor, consent capture, suppression and an unsubscribe all operate** — today none is evidenced ([`MARKETING-COMMUNICATIONS-CONSENT-DRAFT.md`](../legal-drafts/MARKETING-COMMUNICATIONS-CONSENT-DRAFT.md): "PROHIBITED until vendor, consent and suppression operate"). The in-product versions of these messages need no email system and can ship first.

| # | Moment | Type | Basis | Content rule | Exit |
| --- | --- | --- | --- | --- | --- |
| 1 | Invite request received | Service response | Counsel to confirm | Confirms receipt only; no marketing | One message |
| 2 | Invitation | Service | The request | What it is, what it is not, privacy page, who to ask | — |
| 3 | Verification / recovery / security | Transactional | Contract/security | Cannot carry marketing | — |
| 4 | Setup incomplete (24–48 h) | Service | The student started setup | One link back; no guilt | After one send |
| 5 | "AI limit reached for this month" | Transactional | Product operation | Says everything else still works | In-product first |
| 6 | First-week planning prompt | **Marketing** | Opt-in | Value, not nagging | Unsubscribe |
| 7 | Weekly review | **Marketing** | Opt-in only | The student's own choice of day | Unsubscribe |
| 8 | Pre-midterm / pre-registration / pre-finals | **Marketing** | Opt-in | Generic dates; no school claims | Unsubscribe |
| 9 | Week-2 value check; midpoint feedback | Service / research | Consented | One question; reply-to goes to a person | One send |
| 10 | Re-engagement | **Marketing** | Opt-in, frequency-capped | Plain; no "we miss you" | **Inactivity notice before any retention action**, then stop |
| 11 | Export / deletion / offboarding confirmation | Transactional | Request | Confirm what was removed and what remains (backups) | — |
| 12 | "Pilot is paused" | Institutional service | Pilot paper | The existing template | — |

**Default frequency cap for marketing mail: one per week per person.** *Proposed.* `activationGate` requires a cap but the repository does not fix the number; the founder and privacy owner set it. **Never** in a subject line or segment: grades, task or course titles, health or disability information, private conversations.

---

## 6. Growth loops, referral, ambassadors and retention

### 6.1 The loops (hypotheses to test, not forecasts)

A loop is only listed if every step is a feature that exists or a person doing a real thing. No growth multiplier is claimed.

| Loop | How it turns | What travels | What must never travel | Built today? | Measure | Guardrail |
| --- | --- | --- | --- | --- | --- | --- |
| **L1 Shared course** | Student A imports and checks a syllabus → shares that course → classmate opens it (a door that needs no AI key) → checks it → adds it → shares onward | One selected course object | A plan, grades, task history, another person's identity | Yes — "opening one somebody shared" is one of the screen's four doors (`Import.tsx`); sharing with expiry/revoke exists | Share → open → keep rate; week-4 retention of invitees | Opt-out/deletion rate; reports of pressure |
| **L2 Advisor visit** | Student brings a Path Snapshot → advisor sees the shared view → advisor mentions it to the next student | A student-chosen snapshot, time-limited | Anything the student did not select | Yes — advisor shared view exists (`AdvisorSharedView.tsx`) | Shares created; advisor-initiated referrals | Advisor must not be pressured to recommend; no advisor incentive |
| **L3 Workshop** | Orientation / org workshop → activation in the room → students tell peers | Nothing but a QR with a campaign code | Anyone's schedule, grades, status | Workshop kit specified; programme not yet running | Activated per session; week-4 retention | Staff never ask a student to display private data |
| **L4 Use-case content** | Search for "registration checklist" → free tool → optional account | Nothing | — | Tools exist | Tool → invite request → activation | Support burden per channel |
| **L5 Pilot closeout** (institutional) | Pilot closes → aggregate report (cells ≥ 10) → partner chooses whether to be a reference → next buyer's trust review | An aggregate report, and a reference only by written permission | Any student-level data | Pilot machinery exists; no pilot has run | Qualified conversations from permissioned references | CLM-013, CLM-014 |

**What counts as success** is activated, retained, trusting students — not accounts ([`FIRST-1,000-STUDENTS-ADOPTION-PLAN.md`](../market-readiness/FIRST-1,000-STUDENTS-ADOPTION-PLAN.md)).

### 6.2 Referral model

The database already has `referral_codes` (one per ambassador) and `referrals` (which code an account arrived on). [`RETENTION.md`](../../RETENTION.md) fixes the privacy shape: an ambassador sees **a count and nothing else**; deleting either side deletes the row.

**Decision recommended (D5): no monetary or discount referral reward at G1.**

- A student-to-student reward is a price/discount claim (CLM-015) and there is no live billing to give a credit against (the pricing page says checkout is unavailable).
- Paying anyone per sign-up conflicts with the ambassador playbook ("compensate for time/work, not … sign-ups"), and creates the incentive to over-disclose.
- The reciprocal value that already exists is the shared course in L1. Let that be the referral.

Revisit only after counsel clears consumer-protection and endorsement rules and Finance approves a price book.

### 6.3 Ambassador strategy

[`ACTION-PLAN.md`](../../ACTION-PLAN.md) item 7 is **Open**: "Test the ambassador GTM model … recruit a handful; measure installs per ambassador and 30-day retention". Keep it that small.

| Element | Specification |
| --- | --- |
| Size | A handful, one campus context, a time-boxed term |
| Selection | Transparent application, conflict disclosure; no selecting on grades or social following |
| Role | Hosts workshops and answers questions. **Never** collects data, sign-ups or testimonials as a duty |
| Pay | For time and work. Amount and form `[TO BE APPROVED — counsel, Finance]` |
| Training | Product limits, privacy, accessibility, referral safety, escalation, claim list |
| Disclosure | "I'm a Semester student ambassador" wherever they speak about it. Never "official" or "university-run" |
| Content | Synthetic demos only; separate written permission for any quote or image |
| Supervision | Weekly event review; misleading material removed at once |
| Stop | Privacy, security or accessibility harm → stop and escalate. Coercion or misrepresentation → suspend pending review |

**For counsel before anyone is recruited:** worker classification, compensation and tax, minors, endorsement and disclosure rules in the relevant jurisdictions, each host university's rules on commercial activity and on student-run ventures, and insurance for events.

**Measures:** the playbook's — activated users, week-1/week-4 retention, workshop completion, support rate, opt-out/deletion rate, accessibility issues, reported pressure. Scans and impressions are diagnostic only.

### 6.4 Retention communications

Retention is mostly product, not messaging. In order of preference: (1) the product is useful on its own; (2) in-product prompts the student can turn off; (3) email only to people who opted in. Mind the metric's definition: **weekly prepared action** (the north star in [`METRICS-AND-ANALYTICS-PLAN.md`](../market-readiness/METRICS-AND-ANALYTICS-PLAN.md)), not time spent. No dark patterns, deceptive urgency, guilt copy, or notification intensity as an experiment variable ([`EXPERIMENTATION-PROTOCOL.md`](../market-readiness/EXPERIMENTATION-PROTOCOL.md)).

---

## 7. Marketing operations

### 7.1 Attribution

- **One convention.** `{tenant}_{cycle}_{audience}_{objective}`, parsed by `utm.ts`; campaign links carry **no parameters beyond UTM and a placement code**.
- **Model.** Source of the first meaningful touch and source of the invitation request, reported in aggregate. No cross-site identity resolution, no advertising pixels, no fingerprinting, no tracking of individuals.
- **Claim.** Every attribution figure states its model and that it makes no causal claim (`kpi.ts` already exports this).
- **Open item:** this review confirmed the home page loads one script (`/site.js`) and no third-party script tag. It did **not** confirm that the whole site, forms and any hosting analytics collect nothing else. Verify before saying anything about site analytics (§8, M-06 is scoped to the *app*).

### 7.2 Consent

| Person | Basis | Rule |
| --- | --- | --- |
| Student requesting an invite | Service request | Collect the minimum. Marketing consent is a **separate, unticked, unbundled** choice with the exact approved text and version recorded |
| Student in the product | Service | Product messages (limits, security) are transactional and carry no promotion |
| Institutional contact | Business contact, role and work address only | Institution-provided lists are not marketing permission |
| Under-18 or unknown age | **Stop** | Age and jurisdiction logic is a counsel item; the matrix says it "does not authorize marketing to children, students, or any regulated audience" |
| Anyone, any channel | Withdrawal | One step; takes effect on the next send decision; "Yes" never re-subscribes; STOP wins |

Consent text is the template in the draft consent document; version and timestamp live in `gtm_consent` (append-only, latest row wins).

### 7.3 Campaign QA

The server already refuses to activate a campaign that fails these. This is the human checklist for the same list, run before the gate does.

- [ ] Owner is not the approver; privacy, accessibility and brand reviews are current and not by the owner
- [ ] Audience built only from the allow-list (public or self-declared fields). No education-record, aid, health, disability, conduct, protected-trait or poll-response data
- [ ] Every claim has a current §8 row; status words present; qualifiers adjacent
- [ ] Landing page exists, passes §3.3, and carries the UTM convention
- [ ] Opt-out tested end to end; consent version matches
- [ ] Frequency cap set; quiet hours respected in the recipient's time zone
- [ ] No claim exists only inside an image; captions and alt text present
- [ ] Review date is after the campaign's end; takedown owner named
- [ ] Results will be reported with cells under ten suppressed

### 7.4 Lead scoring

**Principle:** score *fit and readiness of an institution's team*, never an individual student.

- **Students:** no scoring. Invitations go out by cohort capacity, in order of request. Behavioral scoring of students is a profiling risk and is outside the stated analytics ethics.
- **Institutional contacts:** use the existing 0–20 scorecard ([`SALES-QUALIFICATION-SCORECARD.md`](../market-readiness/SALES-QUALIFICATION-SCORECARD.md)): 16–20 qualified, 11–15 nurture, 0–10 disqualify — **with the automatic disqualifiers applied before any score**.
- **Marketing-qualified** = a scorecard of 11 or more **and** a stated reason to talk. Engagement (a page visit, a download) may route a follow-up; it never adds to the score.
- **Data held:** a role and a work address; no personal notes about named people ([`INSTITUTIONAL-GTM-PLAYBOOK.md`](../INSTITUTIONAL-GTM-PLAYBOOK.md) rule 1). No student data ever joins a pipeline table (rule 2).

### 7.5 Suppression

A person is suppressed, and stays so, if any of: opted out of marketing; withdrew consent; requested deletion; is under the age boundary or of unknown age; is a student at an institution whose agreement forbids it; is on an institution's own do-not-contact list; or is in an open support, privacy or security case. Suppression is checked on **every** send decision, not at list-build time (`messaging.ts` `decideSend`). Deleting an account removes the person from sends and from referral counts.

### 7.6 Compliance review

| Step | Who | Standard turnaround `[PROPOSED]` |
| --- | --- | --- |
| Claim row created or changed | Claim owner (Harrison Rubin) | — |
| Technical accuracy | Product / Engineering | 2 working days |
| Privacy and data path | Privacy owner `[UNASSIGNED]` | 3 working days |
| Security statement | Security `[UNASSIGNED]` | 3 working days |
| Accessibility | Accessibility owner `[UNASSIGNED]` | 3 working days |
| Legal | Qualified counsel `[UNASSIGNED]` | `[SET WITH COUNSEL]` |
| Publish | Approver ≠ owner | — |
| Monitor and expire | Claim owner | By the row's review date |

**The default when evidence or authority is unclear is: do not publish.** Several roles above are unassigned today, so most rows in §8 cannot reach "approved" until a person holds each seat. That is the real critical path for marketing, and no amount of copywriting shortens it.

**Questions to take to counsel** (collected from this document): the founder-affiliation sentence (5.5); ambassador classification, pay and minors (6.3); referral and endorsement disclosure (6.2); marketing consent, age and jurisdiction logic (7.2); whether D-134 satisfies CLM-015's price approval (F2); whether the privacy sentence in M-17 can be made without a legal entity (F6); comparative claims (§9).

---

## 8. Public claims register

### 8.1 How to read it

This is the **copy-level** register: the actual sentences marketing wants to use. It sits *under* [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) (topics CLM-001–017) and the site register in `ops/claims.ts` (status words). It adds no capability and approves nothing.

- **Status** is the *word* the claim may carry, never higher than the evidence supports: `Limited beta` · `Built and tested, not yet deployed` · `In preparation` · `Planned` · `—` (statement of fact about status) · **`PROHIBITED`**. No row is "Available now": the site register holds none.
- **Owner** is the approval seat (roles). Where the register says counsel or a specialist is unassigned, the row says so.
- **Review by** is a **proposed** date, set by risk: High 2026-11-03 (30 days), Medium 2026-12-03 (60 days), Low 2027-01-03 (90 days). The evidence base is the 2026-10-03 go/no-go and register; any change to either resets it.
- **Risk:** **High** = false or misleading would harm a student or a contract; **Med**; **Low**; **Prohibited** = may not be said.
- A row marked ✋ must not publish until its named blocker is cleared, even though evidence exists.

Paths are repository paths; `app/src/lib/` is shortened to `lib/`.

### 8.2 Register

**A. What it does (students)**

| ID | Exact words (or class) | Status | Evidence | Owner | Review by | Risk | Qualifier / channel limit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M-01 | "One place for your semester — and a clear next step." | In preparation | CLM-001; `ops/claims` `personal-planning`; [`WHAT-IS-SEMESTER.md`](../launch/WHAT-IS-SEMESTER.md) | Product; Legal | 2027-01-03 | Low | Beta label beside it. Not "everything", not "all your systems" |
| M-02 | "Upload a syllabus and Semester finds the deadlines and readings. You check them before you keep anything." | In preparation | `screens/Import.tsx`; [`KNOWN-LIMITATIONS.md`](../launch/KNOWN-LIMITATIONS.md) | Product; AI governance | 2026-12-03 | Med | Needs sign-in or the student's own key; reading uses AI and is metered (F5: the site now says so); "a syllabus can be wrong" adjacent |
| M-03 | "It runs on your device. You don't need an account." | In preparation | CLM-002 (conditional); known limitations: without an account "your semester lives on one device" | Privacy; Product | 2026-12-03 | Med | Say what an account adds (sync) in the same breath |
| M-04 ✋ | "Sign in and your phone and laptop show the same semester." | In preparation | CLM-002: account sync "was not rerun locally against intended target" | Engineering; Privacy | 2026-11-03 | High | **Blocked** until target-qualified. Files attached to notes do not sync — say so |
| M-05 | "AI questions go to the provider in your settings — Anthropic unless you chose another — and only when you press the button." | In preparation | Script; `lib/privacy.ts` `CLAIMS` (privacy text written as data, held by `privacy.test.ts`); CLM-011 | Privacy; AI governance | 2026-12-03 | Med | **Re-verify against the Privacy screen on the day of use** (the script's own rule). Names a provider — recheck on any provider change |
| M-06 | "There is no third-party analytics in the app." | In preparation | Script; observability decision in [`SEMESTER_MARKET_READINESS.md`](../../SEMESTER_MARKET_READINESS.md) | Privacy; Engineering | 2026-12-03 | Med | **Scope to the app.** The company site is not verified |
| M-07 | "Take everything with you, or delete it, any time." | In preparation | `lib/export.ts`, `lib/erase.ts`, `cloud.ts deleteEverything`; `ops/claims` `export-delete` | Privacy; Product | 2026-12-03 | Med | Backups expire on their own schedule and legal holds apply ([`TRUST-CENTER-CONTENT.md`](../market-readiness/TRUST-CENTER-CONTENT.md)); `RETENTION.md` notes no time-based purge sweep for contacts |
| M-08 | "Semester doesn't submit anything to your school or change your records." | In preparation | Known limitations; script | Product; Legal | 2026-12-03 | Low | True of the current build; revisit if write-back ever ships |
| M-09 | "Every fact says where it came from." | In preparation | Design guide principle 2; `lib/source.test.ts` | Product | 2026-12-03 | Med | Describe the five labels; do not imply the facts are correct |
| M-10 | "AI features have a monthly limit per account." | — | `supabase/functions/claude/index.ts:45` (default 60, set by `MONTHLY_CALL_LIMIT`); known limitations | Product | 2027-01-03 | Low | **Do not publish the number**: it is an environment variable and may differ. "AI answers can be wrong" is a required adjacent disclosure |
| M-11 | "Add a calendar link you already have." | In preparation | `lib/feedlink.ts`; [`COMPETITION.md`](../../COMPETITION.md) | Product; Security | 2026-12-03 | Med | A student-pasted link, not an integration with the school. Never "integrates with Canvas/Brightspace" (CLM-005) |
| M-11b ✋ | Anything saying Semester reads a student's learning-system account with a token | Built — not verified | `lib/canvas.ts` | Product; Security; Legal | 2026-11-03 | High | Credential handling and the learning-system vendor's terms are unreviewed. Hold |

**B. Status, access and price**

| ID | Exact words | Status | Evidence | Owner | Review by | Risk | Qualifier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M-12 | "Semester is in a private beta." | — | CLM-003 (verified status) | Founder | 2027-01-03 | Low | Remove the moment the status changes |
| M-13 | "Free during the private beta; paid plans are planned." | — | Pricing page; `ops/claims` `no-sale` | Founder; Finance; Legal | 2026-12-03 | Med | Do not say "free forever" or "always free" |
| M-14 ✋ | "$7.99 a month", "$59 a year", "save 38%" | **Decided (D-134); approval record open** | CLM-015; D-134; `plans.test.ts`, `companysitepricing.test.ts` | Founder; Finance; Tax; Legal | 2026-11-03 | High | Always with "planned; not yet on sale". The saving was 37% before this PR; arithmetic gives 38.5% |
| M-14b | "Plus checkout is not available yet" | — | `ops/claims` `no-sale` | Founder | 2026-12-03 | Low | Keep adjacent to any price mention |

**C. Trust, security, accessibility, AI**

| ID | Exact words | Status | Evidence | Owner | Review by | Risk | Qualifier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M-15 | "We build to WCAG 2.2 AA and run automated accessibility, contrast, reflow and keyboard checks." | In preparation | CLM-007; [`TRUST-CENTER-CONTENT.md`](../market-readiness/TRUST-CENTER-CONTENT.md) | Accessibility; Legal | 2026-11-03 | High | "Target", never "conformant". Two separate evidences (F8): axe over twelve desktop and three phone screens in CI (`a11y-app`), and bounded browser checks on six routes (CLM-007). Name each with its own scope; never "every screen". No ACR exists; disclose that a qualified manual review has not happened |
| M-16 | "Accessible", "WCAG compliant", "VPAT available" | **PROHIBITED** | CLM-008 | — | — | Prohibited | — |
| M-17 ✋ | "We don't sell student data." | In preparation | [`ADVERTISING-AND-MONETIZATION-POLICY.md`](../market-readiness/ADVERTISING-AND-MONETIZATION-POLICY.md); F6 | Privacy; Legal | 2026-11-03 | High | No policy in force; no legal entity. Hold |
| M-18 | "No ad or tracking SDK in the app." | In preparation | [`social.ts`](../../app/src/lib/gtm/social.ts) `NEVER_IN_MARKETING`; `lib/csp.test.ts` (what the app may load) | Engineering; Privacy | 2026-12-03 | Med | Scope to the app; verify against the build on the day |
| M-19 | "Semester's institutional reports are aggregates only, never below ten students, and never an individual risk score." | Planned | `lib/institution-ops.ts` `FORBIDDEN`, `MIN_COHORT`; `lib/cohortfloor.test.ts` | Privacy; Product | 2026-12-03 | Med | The code exists; no institution has it deployed. Say "designed to", not "does" |
| M-20 | "Semester keeps a documented list of what it will never measure." | In preparation | [`PRODUCT-ANALYTICS-DATA-ETHICS.md`](../PRODUCT-ANALYTICS-DATA-ETHICS.md) | Privacy | 2027-01-03 | Low | Link to the page; do not paraphrase it |
| M-27 | Any of: "secure", "encrypted", "compliant", "certified", "pen tested", "SOC 2", "ISO", "FERPA/COPPA/GDPR/HECVAT approved", "data residency guaranteed" | **PROHIBITED** | CLM-009/010 | — | — | Prohibited | Scope-specific factual answers only, after qualified review, in the trust room |
| M-28 | "AI is accurate / unbiased / safe / private / zero-retention / not used for training" | **PROHIBITED** | CLM-012 | — | — | Prohibited | "AI answers can be wrong. Check them." is required |

**D. Institutions**

| ID | Exact words | Status | Evidence | Owner | Review by | Risk | Qualifier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M-21 | "We're looking for a student-success, advising or first-year team to scope a design-partner pilot beside your existing systems." | — | CLM-004; go/no-go (non-activation GREEN) | Founder; Legal | 2026-11-03 | Med | "Scope", not "launch". No "paid". No dates. No live data |
| M-22 | "Semester sits beside your learning management system and student information system. It does not replace them." | — | CLM-004/006; positioning | Founder | 2027-01-03 | Low | The true, safe form of the thesis |
| M-23 | "Your official systems remain the record." | — | `ops/claims` `student-terms`; known limitations | Product | 2027-01-03 | Low | — |
| M-24 | Availability of SSO, SCIM, LTI, OneRoster, SIS or LMS integration | **PROHIBITED as current availability** | CLM-005; `ops/claims` (`oneroster` Not started; `grade-passback` Planned) | — | — | Prohibited | Roadmap wording only: "Planned", no date, non-binding (CLM-017) |
| M-25 | "Semester replaces your LMS / gradebook / SIS / registrar" | **PROHIBITED** | CLM-006 | — | — | Prohibited | Also applies to "Student OS" used as a capability claim (F4) |
| M-26 | The phrase "Student OS" or "operating system" in public copy | ✋ **Decision D1** | Audit thesis; CLM-006 | Founder; Legal | 2026-11-03 | High | Founder- and investor-level only, labelled as direction |

**E. Reputation, outcomes, comparison**

| ID | Exact words | Status | Evidence | Owner | Review by | Risk | Qualifier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M-29 | Any outcome: GPA, retention, graduation, wellbeing, time saved, ROI | **PROHIBITED** | CLM-014 | — | — | Prohibited | State the *measurement hypothesis*, never a result |
| M-30 | Customer or institution name, logo, quote, "trusted by", live pilot, case study, student counts, ratings, rankings, awards | **PROHIBITED today** | CLM-013 | — | — | Prohibited | Also covers "students use Semester at…". A user count is a measured result and needs its own approved method |
| M-31 | "The only free, unlimited planner" and any "only", "first", "best" | **PROHIBITED** | F5; CLM-013 | — | — | Prohibited | False in this repository; superlatives need substantiation |
| M-31b | Any named-competitor comparison | ✋ Legal | §9 | Legal; Product | 2026-11-03 | High | Fair, current, dated; see §9 |
| M-32 | "Uptime", "24/7 support", response times, recovery objectives, "no data loss" | **PROHIBITED** | CLM-016 | — | — | Prohibited | The status page may be linked; do not quote a figure |
| M-33 | "Coming soon" / roadmap capabilities | Planned | CLM-017 | Product; Legal | 2026-12-03 | Med | "Non-binding. No date." Never in a hero, never as a primary CTA |
| M-34 | Family or guardian access to a student's records | **PROHIBITED** | High-risk class; family access is not inferred | — | — | Prohibited | Say only that sharing is the student's choice |
| M-35 | Alumni network, credentials wallet, employer marketplace, "verified talent" | Planned | `ops/claims` (`credentials` Planned: "No badge is issued") | Product | 2026-12-03 | Med | Roadmap block only; no interest capture until consent operates |
| M-36 | "Join our community / ambassadors / events" | — | [`CHANGELOG.md`](../../CHANGELOG.md): nothing is switched on | Founder | 2026-12-03 | Med | Only when a programme actually exists |

### 8.3 Withdrawal and incidents

Taken from the existing register's rule: **an expired, contradicted, over-broad or unapproved claim comes down from every channel the same day and is logged.** Concretely: (1) search for the sentence across site, social, email templates, decks, ambassador kit and the trust center; (2) remove or correct; (3) record channel, time and owner; (4) if it was materially false, escalate to legal, security or privacy as applicable and tell affected readers; (5) find why the register let it through.

**A claim also expires when its dependency does.** If a gate closes (go/no-go changes, evidence ages out), every row resting on it drops to its previous status in the same change.

---

## 9. Competitive positioning and category narrative

### 9.1 The competitive frame

Semester is not competing for the same job as the systems it sits beside. Talk about **jobs**, not products.

| Group | The job they do | Where Semester is different | Say | Don't say |
| --- | --- | --- | --- | --- |
| Learning management systems | The school's teaching and record system | Student-held, cross-source, beside rather than inside | "Beside your LMS" | "Better than", "replaces" |
| Generic planners and calendars | Time and tasks | Reads what the school issues; labels every source | "Knows where each date came from" | "The only…" |
| Syllabus and grade tools (e.g. those catalogued in [`COMPETITION.md`](../../COMPETITION.md)) | Parse a syllabus or compute a grade | Sources, check-before-keep, privacy posture | "You check the dates before you keep them" | Named comparisons without a current, dated check |
| AI study and answer tools | Generate answers or summaries | Press-to-run, source-aware, limits stated | "AI runs when you press the button" | "Safer than…" |
| Campus super-apps | One front door for campus services | Not a campus feed; student-held first | — | — |
| An LMS vendor's built-in AI | Assistant inside the LMS | Works across the systems a student actually has, not one | The structural point in [`MARKET-POSITION.md`](../../MARKET-POSITION.md) §14: LTI 1.3 is a standard, so no partner programme | Anything about a vendor's product beyond its public documentation |

**Rules for any comparison** (also the claim-review matrix's): it must be true today, checked against the competitor's own public documentation on a date written next to it, fair to the competitor, and reviewed by Legal. Competitor facts in the repository date from 18–21 September 2026 and **must be re-verified before public use**. No comparison table until a person has signed it.

### 9.2 Category-creation narrative

**What we are naming.** Not "an app". The problem: a student's term is *assembled by hand, alone, every term*, from sources that never agree. The category that answers it is the **student action platform**: a student-held layer that turns a term's scattered sources into a plan and a next step, and shows its working.

**Why now, in claims we can stand behind.** Institutions run authoritative systems built to hold records, not to help one student decide what to do tonight. AI makes summarising cheap and trust expensive — which makes *showing the source* the scarce thing. Those are framing statements, not statistics; no figure is quoted unless a source is cited and dated.

**The arc, by audience.**

| Audience | Arc |
| --- | --- |
| Student | You shouldn't have to assemble your own semester. Semester does it once, shows the work, and leaves it with you. |
| Institution | Your systems hold the record. Students still build their own plan beside them. A bounded, measurable, reversible way to help with that, without replacing anything or watching anyone. |
| Press / thought leadership | The next fight in student technology is not who has the cleverest assistant. It is whose assistant will show its sources and say what it can't do. |
| Investor (labelled direction) | The thesis is that a student-held layer, trusted first, can grow into more of a student's life — family, career, the alumni years. Every step is gated by evidence. The register, not the pitch, says what is live. |

**Use of the founding thesis.** "Every part of a student's educational life works in Semester from day one" is the founder's *direction*. It is not public copy and not a capability statement. Public copy says what exists (§8), and the roadmap block says where it is going, with no dates.

**Defensibility.** The durable advantage is not a feature list; features copy fast. It is **being the vendor whose claims survive a procurement review**: a public register, an honest gap list, a refusal list. That is slow to build and expensive to imitate, which is the point.

---

## 10. Metrics

**Principle.** Every metric states its period, denominator, sample size, source, freshness and caveat ([`METRIC-DICTIONARY.md`](../market-readiness/METRIC-DICTIONARY.md)); no cell under ten is reported; no figure is called causal without an approved design. **Targets are `[SET AFTER BASELINE]`**: none has been measured, and inventing one would be the exact failure the register exists to prevent.

| Layer | Metric | Definition | Source | Status |
| --- | --- | --- | --- | --- |
| **Awareness** | Inbound invite requests, by first-touch source | Count of invite requests; first meaningful touch from the UTM convention | Form + UTM | New |
| | Branded and direct inbound | Visits arriving without a campaign code | Aggregate, privacy-safe only | New; method needs approval (site analytics unverified, §7.1) |
| | Earned mentions | Count of third-party mentions that are accurate | Manual log | New |
| **Activation** | Activated student | Consent/notice done + minimum setup | `student_activated` | In dictionary |
| | First win | Reaches Today, understands one source-labelled reversible action and the help route, and intentionally completes, schedules, snoozes or defers it | `student_first_win` | In dictionary — **proposed, needs validation** |
| | Time to first value | Consented start to first win, with incomplete attempts reported as censored | Events | In dictionary |
| **Conversion** | Invite → account → first win | Stepwise rates, each with its own denominator | Events | New composition |
| | Institutional: target → qualified → discovery → trust review → proposal | The stages in `stages.ts` | `gtm_accounts` | Exists |
| | Conversion (pilot to annual) | Sponsor-approved move to an executable annual scope | Commercial system | In dictionary |
| **Retention** | Week-1 / week-4 retention | Returning activated students ÷ activated cohort | `public.activity` | Exists |
| | **Weekly Prepared Action Rate** (north star) | Activated students completing a weekly plan and one self-selected next action ÷ eligible activated, privacy-safe cohorts | Events | In plan |
| **Pipeline** | Qualified conversations | Scorecard ≥ 11 with a stated reason | CRM | New |
| | Trust-room requests and completions | Requests made / reviews completed | `trust_room_*` tables | Exists |
| **CAC** | Cost per activated student, by channel | Fully loaded channel cost ÷ activated students from that channel | Finance + events | **Not computable at G0–G1**: no paid acquisition and no spend ledger. Report ambassador and content cost; do not invent a CAC |
| | Institutional CAC | Fully loaded sales and marketing cost ÷ signed design-partner pilots | Finance | Not computable until a pilot signs |
| **Brand trust** | Claims incidents | Count of claims that came down, and hours to correct | Claims log (§8.3) | New. Target: zero reaching a channel |
| | Reviewer escalation rate | Trust-center questions answered from the public tier without a person | Trust room log | New |
| | Opt-out, deletion and complaint rates | Per campaign and channel | `gtm_*` | Exists |
| | Source-understanding check | After activation, one consented question: "I understand where Semester's information comes from" (5-point) | Consented survey, n ≥ 10 | New; wording needs accessibility and privacy review |
| **Guardrails** | Support contact rate; P0/P1 count; accessibility blockers; AI cost per activated student | As the metrics plan | Support, incidents, cost | In plan |

**Stop rule.** A channel that breaches a guardrail pauses even while the headline grows. This restates the first-1,000 plan and is not negotiable by the marketing team.

---

## 11. Sequence, owners and open decisions

### 11.1 Next 90 days, mapped to the existing programme

These are the marketing share of tasks already in [`90-DAY-LAUNCH-PROGRAM.md`](../90-DAY-LAUNCH-PROGRAM.md) (`demo-pages`, `trust-outline`, `launch-metrics`, `a11y-core`, `comms`, `quotes`); owners there are roles.

| Window | Marketing work | Closes with |
| --- | --- | --- |
| Days 1–30 | Confirm the production invite switch (F3); get counsel's answer on F6; assign the empty review seats; reconcile CLM-015 with D-134; build the §8 register into `ops/claims` data so a test holds it; trust center "Not yet in place"; calendar weeks 1–4 | Founder sign-off on D1–D8; a claims row for every sentence on the home, pricing and institutions pages |
| Days 31–60 | Demo and role pages on synthetic data; captioned demo video; use-case pages; calendar weeks 5–8; qualify first ten accounts by warm path | A demo that runs on synthetic data only; trust center reviewed by a person outside the team |
| Days 61–90 | Cohort comms (school-sent, from templates); ambassador pilot only if counsel clears it; calendar weeks 9–12; first baseline for the §10 metrics | Go/no-go for G1 for one named cohort |

### 11.2 Decisions needed from the founder

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Public category name | "Student action platform". Keep "Student OS" off public pages (F4) |
| D2 | Reconcile CLM-015 / `PRICING-AND-PACKAGING.md` with D-134 | The prices stand (D-134, planned, not on sale). Either record D-134 as the approval CLM-015 asks for, or revise D-134. The "save N%" figure is corrected |
| D3 | Hero button | Keep "Start planning free" if production invite-only is confirmed on and the app can be used locally; otherwise "Request an invite" (F3) |
| D4 | "Paid pilot" in public copy | Not until the paid profile converts; the positioning doc now says so (F1) |
| D5 | Referral reward | None at G1 (§6.2) |
| D6 | Marketing mail frequency cap | One per week, subject to privacy owner |
| D7 | Founder-affiliation wording | Do not name the university until counsel answers (§5.5) |
| D8 | Who holds the privacy, security, accessibility and counsel seats | Name people; the plan cannot publish a High-risk row without them |

### 11.3 What this document did not do

- **Did not run, browse or deploy the site or app.** Site observations come from reading `company-site/` source. Whether the invite switch is on in production (F3), and whether the site collects anything beyond its one local script were not verified.
- **Did not read the whole audit PDF.** The first twelve pages, which carry the founding prompt and thesis, were read in full; the rest was text-searched for marketing, pricing and launch-gate content. Anything outside those passages is not reflected here.
- **Did not verify competitor facts.** Everything about other products is taken from the repository's own dated documents and flagged for re-verification.
- **Did not obtain any approval.** The review dates and turnarounds are proposals. Counsel and specialist seats are unassigned.
- **Did not edit the canonical register, the site or the claims code.** Rows M-01–M-36 are proposals to be added by their owner, with the usual evidence record. Per [`CLAUDE.md`](../../CLAUDE.md), a decision takes its pull request's number: D1–D8 become `docs/decisions/D-<PR number>.md` once decided, not before.
- **No "shared preamble" was found** in the repository or the attached document. This was written to the repository's own rules ([`CLAUDE.md`](../../CLAUDE.md), the go/no-go and the claim policy). If a preamble exists elsewhere, send it and the document will be checked against it.
