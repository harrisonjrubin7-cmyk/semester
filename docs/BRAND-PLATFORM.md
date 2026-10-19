# Semester brand platform

> **DRAFT FOR OWNER REVIEW AND CLAIMS REVIEW.** Nothing here is an approved public
> claim, a trademark clearance, or legal advice. Every sentence marked
> *candidate* is subject to the process in
> [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../PUBLIC-CLAIMS-APPROVAL-REGISTER.md);
> the register's default applies: **when evidence or authority is unclear, do not
> publish.**

| Control | Value |
| --- | --- |
| Status | Draft 1 — proposes a brand platform; approves nothing |
| Date | 2026-10-04 |
| Role | Brand and Creative Director (from the shared preamble in the audit) |
| Checked against main | `origin/main` at `7287ddc`. No brand-platform, voice or tagline work has landed (searched commit titles and the docs tree). The visual identity itself *has* landed; see §0.2 |
| Owner | Claim-owner is Harrison Rubin per the register. Counsel, accessibility, privacy and security approvers are **unassigned**, so §8's upper tiers cannot operate yet |

## 0. Read this first

### 0.1 What this document is

The brief asks for a distinctive, premium, trustworthy identity that can carry
both student creativity and institutional reliability, without unverified claims
and without visual design that hides warnings, status, provenance or
accessibility. This document answers in ten parts (§1–§10), then lists the
assumptions, risks and traceability the shared preamble requires (§11).

### 0.2 What already exists, and what that decides

The repository already has a coherent, tested identity. This platform **names and
extends it**; it does not replace it.

| Established | Source of truth | Guarded by |
| --- | --- | --- |
| Three-slab mark, drawn once and generated into every logo and the favicon | `app/src/components/mark.data.ts`, `company-site/icon.svg` | `mark.test.ts`, `companysitebrand.test.ts` |
| Graphite / Brass / Sterling palette; 13 grounds, 11 accents, one warning colour | `app/src/lib/look.ts`, [`COLOR-AND-DARK-MODE-SPEC.md`](COLOR-AND-DARK-MODE-SPEC.md) | `lib/contrast.test.ts` |
| Cinzel display, Barlow Condensed headings and wordmark, Barlow text; 12 local font files under OFL | `company-site/fonts/`, [`DESIGN-SYSTEM-GUIDE.md`](../DESIGN-SYSTEM-GUIDE.md) | `companysitebrand.test.ts` (byte equality with the app) |
| Six cross-surface role names `--brand-canvas/-surface/-ink/-muted/-accent/-focus` | `company-site/site.css`, design-system guide | design contracts |
| Provenance ladder: Official, Connected, Made here, Yours, Sample, Out of date | `app/src/lib/where.ts`, [`TRUST-CUES-AND-SOURCE-PRESENTATION.md`](TRUST-CUES-AND-SOURCE-PRESENTATION.md) | `where.test.ts` |
| Nine owned terms (Student Action Layer, Source-Aware Student Experience, …) | `app/src/lib/vocabulary.ts` | `vocabulary.test.ts` |
| Public brand page: casing rule, product names, "demo data" rule, no "certified/guaranteed" | `company-site/index.html` (`data-page="brand"`) | site tests |
| Eighteen claim rows with approval state (`CLM-018` is proposed, not approved) | [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) | `salecopy.test.ts` and related |

**Two consequences.** First, every visual recommendation below is either an
existing rule restated with its measured evidence, or a clearly marked
*proposal*. Second, the verbal identity is built on what the register allows,
because that is the binding constraint.

### 0.3 The tension the brand has to resolve

The audit's founding thesis is that Semester "centralises and replaces all
school and education systems in one place." The register classifies exactly that
as **`CLM-006` — PROHIBITED**, and the audit itself (its "Practical launch
strategy") says not to pitch it to a first customer. A brand that says the
prohibited sentence is a brand the company cannot publish.

The resolution used throughout: **the ambition is internal; the public brand
speaks to the next step, the source and the student's control.** The company can
grow into larger sentences as evidence arrives, and §8 defines how a sentence
earns its place. "Student OS" is therefore an *internal and analyst-facing
category label*, not a public descriptor. The owner decided on 2026-10-04 to
keep **"student action platform"** as the public descriptor
([`D-1148`](decisions/D-1148.md)); "Student OS" implies replacement (see §1.8).

### 0.4 What was and was not verified

- **Verified in this session:** the repository files cited above; contrast
  ratios in §2.2 and §4 (computed by me from the hex values in `look.ts` and
  `site.css` with the WCAG relative-luminance formula; I did **not** run
  `contrast.test.ts`, because dependencies are not installed in this checkout).
- **Not verified:** any competitor's *current* visual identity (§9 describes
  category conventions from general knowledge and must be re-checked before it
  leaves the building); trademark availability; logo legibility at the minimum
  sizes proposed in §2.1; any audience's reaction to the identity (no research
  was run); whether Barlow/Cinzel cover every language an institution will need
  (they do not; see §4.6).

---

## 1. Brand platform

### 1.1 Audiences, and what each needs the brand to prove

| Audience | The question they are really asking | What the brand must make visible |
| --- | --- | --- |
| Student | "What do I do next, and can I trust this?" | One clear next step; where each fact came from; that they hold the controls |
| Family / guardian | "What can I see, and who decided that?" | Consent boundaries stated in plain words |
| Faculty / advisor | "Will this create work or risk for me?" | Scope of authority; no claim to replace their judgment |
| Institution admin / registrar | "Does it respect our records and policy?" | Official systems stay authoritative unless an institution decides otherwise |
| IT, security, privacy, accessibility | "Show me the evidence, including the gaps." | Named controls, named limits, dated evidence |
| Procurement / leadership | "Is the company real, and are the promises binding?" | Status honesty; no puffery; a trail from claim to evidence |
| Partner | "Can I be associated with this safely?" | Written co-marketing rules; verified-tier meaning |

### 1.2 Purpose, mission, positioning

*All candidate; none approved for public use.*

- **Purpose (internal):** Make academic life legible: what matters, why, and what
  to do about it.
- **Mission (candidate):** Help students see what to do next, and where the facts
  behind it come from. *(Register row `M-43`; internal until `CLM-018` is
  approved. The first draft said "every student" and "every fact"; the evidence
  does not support the second.)*
- **Vision (internal only — do not publish):** Every part of a student's
  educational life works in one governed place. *Reason for the restriction:*
  stated as fact it runs into `CLM-005`, `CLM-006` and `CLM-017`.
- **Positioning (candidate, matches `CLM-001` and `CLM-004`):** For students
  who juggle a plan, deadlines and several official systems, Semester is the
  academic workspace that turns what you have into the next thing to do and
  keeps the source of each fact beside it. For institutions, it works
  *alongside* the systems of record in a bounded pilot, and never claims their
  authority.

### 1.3 Personality

Semester's personality is **a good registrar's assistant crossed with a precision
instrument**: exact, calm, unshowy, on the student's side.

| Trait | Means | Does not mean |
| --- | --- | --- |
| **Exact** | Names the object, the date, the source, the consequence | Cold or legalistic |
| **Calm** | Lowers the temperature of a stressful moment; no countdown theatre | Sleepy or vague |
| **Candid** | Says what it cannot determine, and what is stale | Self-flagellating or apologetic by reflex |
| **Warm, sparingly** | One human sentence where a human would want one | Chatty, jokey or exclamatory |
| **Self-possessed** | Confident because it shows its work | Boastful; comparing itself to others |

Anti-personality (what Semester must not sound or look like): hype ("revolutionary",
"supercharge"), guilt ("you're falling behind!"), surveillance ("we noticed you…"),
institutional fog ("stakeholders will be leveraged"), and AI-mystique (sparkles,
glowing orbs, a named, human-seeming assistant).

### 1.4 Values, each as a behaviour a reviewer can test

| Value | Behaviour test | The thing we will not do |
| --- | --- | --- |
| **Action before inventory** (design guide principle 1) | Does the screen or message lead with the next safe action? | Open with a feature list or a dashboard of everything |
| **Name the source** | Can a reader tell official, connected, yours, estimated, AI-assisted at a glance, in words? | Blend an estimate into a fact |
| **Say what we cannot do** | Is every limit stated where the promise is made? | Move the limit to a footnote or a later page |
| **The student holds the keys** | Can they see, export, change and revoke? | Collect or share by default; steer with dark patterns |
| **Calm is a feature** | Does it work in the reduced-motion/calm setting without losing meaning? | Use urgency, streak shame or decorative motion |

### 1.5 Promise

The brand promise is a **design standard the product is held to**, not an outcome
and not yet a public claim:

> **Where Semester shows a fact, it shows where it came from and how far to rely on it.**

*Corrected 2026-10-04.* The first draft said "Every fact in Semester…". The
evidence check for the proposed register row `CLM-018`
([`CLM-018-SOURCE-LABEL-EVIDENCE.md`](CLM-018-SOURCE-LABEL-EVIDENCE.md)) found
source labels on 30 component and screen files, not on every screen, so the
unscoped sentence is unsupported (it stood as `M-09` in the copy register and is
now `M-09b`, prohibited). The **public** form is the `CLM-018` wording, scoped to
"where Semester shows a source label", and it is proposed, not approved. The
trust-cues document also records that `official` is reserved and no code path
returns it today; the public promise must not imply that label, or the unused
`faculty-approved`, `course-provided` and `updated-today`, appear on screens.

Explicitly *not* promised: grades, retention, time saved, wellbeing, or
replacing any official system (`CLM-006`, `CLM-014`).

### 1.6 Narrative (long form, candidate)

Three beats. No statistics, no named customers, no outcomes.

1. **The problem is scattered, not scarce.** A semester is made of small facts
   — a due date, an office's hours, a requirement, a reading — kept in many
   places by many owners. Students do the assembling by hand.
2. **The answer is a next step, with a receipt.** Semester pulls what a student
   has into one workspace and turns it into the next thing to do. Each fact
   keeps its label: from your school, from a calendar you connected, made here,
   typed by you, or a sample.
3. **The student, and the school, stay in charge.** Institutions keep data
   authority and choose approved sources and roles. Students keep control of
   their plans, drafts and sharing. Where Semester is unsure, it says so and
   points to the official or human route.

Short form (candidate; register row `M-44`, blocked until `CLM-018` and the
sharing review clear): *Semester turns your semester into one clear next step.
Where it can, it shows the source of each fact. Your school's official systems
stay official. You decide what is shared.*

### 1.7 Voice

One voice, two registers. The register changes density and vocabulary, never
honesty.

| | Student register | Institutional register |
| --- | --- | --- |
| Reader | Someone mid-task, often tired | Someone evaluating risk, with time and a checklist |
| Sentence | Short; one idea; active | Complete; qualified where it must be; dated |
| Opens with | The action | The scope and the status |
| Numbers | Few, rounded only if the product rounds | Exact, with source, date and version |
| Humour | Almost never; never at the student's expense | Never |
| Reading target | Plain language; aim for a middle-school-to-early-high-school reading level | Plain language, with defined terms |

**The status sentence** — the unit of Semester voice for anything that went
wrong, is pending, or is uncertain — has three parts:

> **What is true** → **what that means for you** → **what you can do.**
>
> "Your Canvas calendar hasn't updated since Tuesday. Deadlines below may have
> moved. Reconnect it, or check the course page."

**Rules**

1. Name the object: "your Canvas calendar", not "your data".
2. Say the consequence before the apology; apologise only for real fault.
3. Never write a fake success: no "All set!" while a sync is pending.
4. Use the product's own words: Today, My Path, Search, Plan, Me; Ask Semester;
   Course Studio. Do not invent a synonym per page.
5. Numbers carry units and a source or "estimated".
6. Contractions are fine in student copy. Exclamation marks are for nothing.

**Words**

| Prefer | Avoid, and why |
| --- | --- |
| "helps you organise", "turns … into" | "revolutionises", "transforms" — outcome puffery (`CLM-014`) |
| "alongside your school's systems" | "replaces", "all-in-one", "everything school" — `CLM-005/006` |
| "AI-assisted, source-linked" (the repo's label) | "AI-powered", "intelligent", "knows you", "magic" |
| "built with controls for …", the *named* control | "secure", "private", "safe", "compliant", "certified", "FERPA-approved" unqualified (`CLM-010`) |
| "planned", "in private beta", "in a bounded pilot" | "launching soon", "coming Spring", dated promises (`CLM-017`) |
| "can", "is designed to" | "guarantees", "always", "never fails", "100%" |
| "student" | "user", "learner" in student-facing copy |

### 1.8 Naming

| Layer | Rule | Today |
| --- | --- | --- |
| **Master brand** | "Semester" in running text, always. The wordmark lockup is set in capitals by the typeface treatment (`SEMESTER`); the capitals are a logo, not a spelling. Never "the Semester app" in a headline | existing brand page |
| **Descriptor** | A category line may follow the name. **Public descriptor: *"the student action platform"*** (site title; owner decision [`D-1148`](decisions/D-1148.md)). **"Student OS" is not a public descriptor** | decided |
| **Destinations** | Today, My Path, Search, Plan, Me — the five canonical destinations. No sixth global product for a specialist feature | design guide |
| **Named tools** | Plain nouns: Course Studio, Study Studio. Test: could a student guess what it does? | existing |
| **Assistant** | **Ask Semester.** No human name, no avatar face, no pronoun "I" in marketing. Always labelled as AI where it speaks | proposed rule |
| **Owned terms** | The nine in `vocabulary.ts`, used with their one-sentence definitions and always beside the claim, never instead of it | existing |
| **Plan names** | Existing plan names carry "(planned)" until a price book and billing flow are approved (`CLM-015`) | existing |
| **Partner tiers** | Registered, Verified, Strategic. "Verified" must mean the stated review passed; never a badge before the review | existing site |

**Naming test for any new feature:** (1) plain noun or noun phrase; (2) no
"Smart", "Magic", "AI", "Pro" prefix; (3) does not imply an official authority
("Registrar", "Transcript") unless the institution supplies the record;
(4) passes the screen-reader test (reads naturally aloud); (5) trademark search
done by counsel. **No trademark clearance has been performed for "Semester" or
any product name** (`IP.md` and `docs/legal-drafts/IP-ASSET-INVENTORY-TEMPLATE.md`
are the right homes).

### 1.9 Taglines

All **candidates; none approved**. The register requires an approval record per
exact variant and channel.

| # | Line | Audience | Rationale | Claim check | Status |
| --- | --- | --- | --- | --- | --- |
| T1 | **One clear next step.** | Student, general | Already the site's H1 idea; action-first | `CLM-001` (describe the exercised experience only) | Primary candidate |
| T2 | **Know what's next. Know where it came from.** | Student, trust | Joins the two halves of the promise | `CLM-018` proposed | Candidate; register row `M-38` ✋ pending `CLM-018` |
| T3 | **Your semester, with sources.** | Student, social | Short, ownable, slightly dry | Same | Candidate |
| T4 | **Beside your systems, not instead of them.** | Institution, sales | Turns the `CLM-006` prohibition into a stance | `CLM-004` — *must carry "in a bounded pilot" in the same view* | Sales-only, qualified |
| T5 | **Status is part of the product.** | Institution, trust centre | Already on the site; unusual and true to the design | `CLM-007` / `CLM-009` if tied to specifics | Candidate |
| T6 | **You decide what's shared.** | Student, family | Plain statement of the consent model | `CLM-002` conditional; scope to exercised sharing | Candidate pending Privacy review |

**Rejected, with reason** — so they stop coming back:

| Line | Why not |
| --- | --- |
| "The Student OS" / "Your school, in one place" | Implies replacement and breadth (`CLM-005/006`) |
| "Study smarter" / "Ace your semester" | Outcome promise (`CLM-014`); generic |
| "AI that knows you" | Anthropomorphic; profiling connotation; `CLM-012` risk |
| "Secure by design" | `CLM-010`; "secure" unqualified is prohibited |
| "Replace your campus stack" | `CLM-006`, prohibited |
| "Built for every student" | Reads as an accessibility/universality claim (`CLM-008`) |

---

## 2. Visual identity

### 2.0 Direction in one line

**A quiet instrument, not a campus mascot.** Graphite and Brass, a precise
three-slab mark, a Roman display face paired with a condensed utility face, and
a signature device — the **Source Line** (§2.6) — that makes provenance the
brand's most recognisable visual idea.

*Interpretation, flagged as retrospective:* the repo does not record what the
three slabs mean. A reasonable reading — three staggered pillars of different
heights, like terms, columns or steps — suits an academic calendar and a path,
but the identity should not depend on that reading, and no copy should assert
it.

### 2.1 Logo

**Components** (existing): the **mark** (three staggered slabs, each a lit front
face and a darker side edge; geometry in `mark.data.ts`, `viewBox` for the flat
version `128 65 256 382`), and the **wordmark** (`SEMESTER` in Barlow Condensed).

| Variant | Use | Colour |
| --- | --- | --- |
| **Chrome mark on tile** | App icon, favicon, store icon, social avatar | The generated gradient on `#0a0b0e`, tile corner radius ≈ 22% (`rx 114` of 512) |
| **Flat mark** | UI chrome, site header, documents | `currentColor` — takes the surrounding ink |
| **Lockup** (mark + wordmark) | Headers, decks, letterhead, sales | Flat, in ink or Brass-on-dark |
| **One-colour** | Print, embossing, fax-grade, watermarks | Single ink, no gradient, no edge shading |
| **Reversed** | On photography or accent fills | White or ink, **only** where contrast ≥ 3:1 for the mark (it is a graphical object) |

**Clear space — proposal.** Keep a margin of at least one slab's total width
(front face plus edge ≈ 76 units on the 256-unit mark, about 30% of mark width)
on all sides. **Minimum size — proposal, unverified:** flat mark 16 px (screen),
lockup 96 px wide, chrome tile 24 px. Backlog item **B-04** renders these sizes
and proves or revises them; until then treat them as provisional.

**Misuse** (extends the existing "never stretch or add effects"):

1. No stretching, rotating, outlining, or re-ordering slabs.
2. No drop shadow, glow, bevel or animation loop on the logo.
3. No gradient chrome on a light ground: use the flat or one-colour mark.
   (Chrome mid-tone `#7f8693` measures 3.66:1 on white — acceptable for a
   graphic, no margin for error — and 5.37:1 on the dark tile.)
4. No Brass **text or thin strokes** on a light ground (§2.2: 1.59:1).
5. No institution's logo fused with the mark. Side-by-side only, with a divider.
6. Never use the mark as a bullet, loader spinner, or status icon. It must not
   be mistaken for a state.
7. Do not put the mark on a customer's collateral implying endorsement without
   written approval (`CLM-013`).

**Co-branding and tenant branding.** Institutions may configure their own logo
and one accent *within a branding envelope*: they may not recolour, hide or
restyle status chips, provenance labels, the warning colour, AI labels, consent
text, or the accessibility controls. Those are **brand-exempt zones** (§4.1).

### 2.2 Colour

Three tiers, one rule: **reserve colour for one meaning and carry the rest in
words and glyphs** (the repo's existing one-warning-colour principle).

**Tier A — public identity (fixed editorial palette)**

| Role | Token | Hex | Contrast of Brass/ink against the four public surfaces* |
| --- | --- | --- | --- |
| Canvas | `--brand-canvas` | `#16181C` Graphite | — |
| Surface | `--brand-surface` | `#1F2229` | — |
| Ink | `--brand-ink` | `#ECEEF2` | 15.30 / 13.71 / 12.05 / 10.11 |
| Muted | `--brand-muted` | `#B4B7BF` | 8.86 / 7.93 / 6.98 / 5.86 |
| Faint (site) | `--ink-faint` | `#A0A5AF` | 7.19 / 6.44 / 5.66 / 4.75 |
| Sterling | — | `#D4D9E2` | — |
| Accent / focus | `--brand-accent`, `--brand-focus` | `#D8C79A` Brass | 10.63 / 9.52 / 8.37 / 7.02 |

\*Against `#16181C`, `#1F2229`, `#282C34`, `#333843` in that order. All clear 4.5:1.

**Tier B — product (user-selected)**

Thirteen grounds (eight dark, five light), eleven accents, per-ground warning
colour, "Increase contrast" floor, and "Match my device". Marketing assets that
show the product must show **both** a dark ground (Ink) and a light ground
(Parchment), because the brand is the *system*, not one skin.

| Pair (computed from `look.ts`) | Ratio | Rule it supports |
| --- | --- | --- |
| Ink text on panel `#12141A` | 15.85 | Body text: fine |
| Ink "dim" rung on panel | 7.03 | Secondary text: fine |
| **Ink "faint" rung** on panel / raise | **3.71 / 3.52** | **Not text.** Hairline-grade only |
| Parchment "faint" on panel / void | **3.50 / 3.33** | Same |
| Brass base `#D8C79A` on Ink panel / raise | 11.01 / 9.06 | Brass is a dark-ground text colour |
| **Brass base on Parchment panel** | **1.59** | **Never text or thin line on light** |
| Brass **shade** `#695A33` on Parchment panel / void | 6.42 / 5.32 | Light-ground Brass = the *shade* stop |
| Sterling shade `#4C5561` on Paper panel | 7.36 | ditto |
| Ink panel vs Ink bg (surface step) | 1.07 | Surfaces are separated by hairline and tone, **not** relied on for meaning |

The repository already holds the faint rung to 3:1 as "a hairline's bar" and
keeps small caps in dim, not faint (`contrast.test.ts`, §"quiet caps"). The brand
rule makes that explicit: **the app's faint rung may never carry information-
bearing text.** I did not audit how many of the 59 `--app-faint` references
across 19 files are text; backlog **B-21** does that.

**Tier C — campaign extension (proposal).** Campaigns use Tier A or one Tier B
ground + one accent. **No new hue.** No gradient other than the chrome face of
the mark. Maximum one accent per composition. Course colours identify courses;
they never signal success or error and never appear in campaign art as if they
did.

**State colour.** One warning colour, per ground, held at ≥ 4.6:1 on every
surface of that ground (spec). Success and info share the accent. **Every state
carries a word and a glyph**; colour is a third, redundant signal.

### 2.3 Typography

| Role | Face | Use | Never |
| --- | --- | --- | --- |
| Display | **Cinzel** | Major page statements, campaign headlines, **large** | Body, UI labels, status, warnings, errors, more than ~8 words per line, small sizes |
| Heading / wordmark / controls | **Barlow Condensed** (400, 600) | Navigation, headings, dense cards, `SEMESTER` | Long paragraphs |
| Text | **Barlow** (400, 500, 700) | Body, forms, data, support, institutional documents | — |
| Identifier | Mono | Short IDs, timestamps, source metadata | Prose |

- Fonts are **self-hosted** (12 files; OFL text shipped). Marketing must not add
  a third-party font request: it would add a network call the privacy copy does
  not account for.
- **Type must yield to the reader.** The product has Text size (Compact 0.94 to
  Largest 1.18) and dyslexia-aware modes are a requirement in the audit. Brand
  layouts use relative units, reflow at 320 px and 200% zoom, and never fix a
  headline size in pixels.
- Measure 58–72 characters; one H1 per page; heading level is structure, not size.
- **Cinzel caution.** A Roman display face with no true lowercase is elegant at
  large sizes and poor for scanning. It is why the rule above bans it from status
  and warnings: the brand's most distinctive face must never carry the messages
  that most need to be read.
- **Scripts.** The shipped files are Latin and Latin-Extended only; see §4.6.

### 2.4 Illustration

*Diagrammatic, not mascot.*

- **Vocabulary:** slabs, lines, nodes and rules — shapes derived from the mark.
  Flat; one ink, one accent; hairline strokes ≥ 1.5 px at 24 px grid; no outer
  glow.
- **Subjects:** flows (a deadline → its source → the next step), maps of
  responsibility (who owns what), status maps (use now / needs a pilot / later).
- **Not used:** cartoon students, robots, brains, sparkles, lightbulbs,
  graduation caps, confetti, gamified badges, characters of any kind.
- **Honesty rule:** an illustration of the product must be labelled
  "Illustration" and must use demo data. An illustration must never depict a
  capability, integration or outcome the register has not cleared.

### 2.5 Photography

- **Style:** documentary, natural light, working moments (reading, planning, a
  conversation with an advisor), real settings, minimum staging.
- **Consent:** written release for every identifiable person; guardian consent
  for minors; no real student data legible on any screen; no institution
  name, mark, building or uniform visible unless the institution has approved
  that exact use (`CLM-013`).
- **Captions:** say when an image is staged, a stock photograph, or illustrative.
  A photograph of "a student" is never captioned as a customer or user unless
  they are one and have consented.
- **Treatment:** no heavy filters, no duotone on people, no skin-tone shifts.
  Text over photography only on a solid scrim that measures ≥ 4.5:1 at the
  *worst* region under the text (not the average).
- **Generated imagery:** not used to depict real students, campuses, testimonials
  or outcomes. If used decoratively it is labelled, and it never appears in
  trust, privacy, accessibility or incident content.
- **Alt text** is part of the asset, written at production time (§4.4).

### 2.6 Signature device: the Source Line

A **thin Brass line** that runs from a statement to a small source chip
("Official · Registrar, 3 Oct", "Yours", "Out of date"). It is:

- the visual form of the promise in §1.5;
- usable on a product screen, a deck, a social card, a report;
- **never decorative** — it appears only where a real source label exists, so
  its presence is itself evidence; absent source, absent line.

The chip always carries the word; the line is redundant reinforcement and must
not be the only cue (§4.1).

### 2.7 Iconography

- Use the application's existing icon module (`components/Icons.tsx`,
  `icons.data.ts`); do not mix icon sets.
- Icons are **never the only carrier of meaning.** Status icons are paired with
  the status word (the repo's status glyph set in `lib/status.ts`).
- 24 px grid, consistent stroke, 44 px touch target via the `.tap` expansion
  where the glyph is smaller.

### 2.8 Motion

- Motion roles: fast feedback (≈140 ms), standard (≈200 ms), panel, sheet,
  progress — from the design guide; **every role zeroes** under
  `prefers-reduced-motion` and Semester's calm/still settings.
- Motion explains cause and effect or spatial continuity; it does not advertise
  quality. No parallax, no looping decoration.
- **Logo animation (proposal):** permitted only in launch video or splash; plays
  **once**, under about one second; static equivalent always available; never
  loops; never in-product after first paint.
- **Video:** captions and transcript at publication, audio description where the
  visual carries information, no autoplay audio, no flashing (≤ 3 per second),
  and anything auto-playing for > 5 s has a pause control.
- **Synthetic voice** (the repo has an `audio/` pipeline): disclosed as
  synthetic wherever a listener could mistake it for a person.

### 2.9 Data visualisation

Follows the principle that the chart is a statement with a source.

1. **Encode provenance, not just value.** Solid = official/connected;
   outlined = yours; hatched = estimated or AI-derived; dotted = out of date.
   Distinguishable in greyscale, and **every** series is labelled directly, not
   by a legend alone.
2. **Palette:** one accent plus neutrals; at most four categorical series, each
   differing by lightness *and* pattern; no red/green pairing; sequential
   scales monotonic in lightness.
3. **Every chart carries** title that states the finding, units, source, date,
   and — if the data is demo data — the words "Illustrative demo data".
4. **Truth rules:** zero baseline for bars; no truncated axes without a break
   mark; no dual axes; no cumulative chart that hides a drop; uncertainty shown.
5. **No outcome charts** (GPA, retention, time saved) until `CLM-014` is
   satisfied with a measured baseline and an approved record.
6. **Accessible by construction:** a data table or text summary adjacent to
   every chart; keyboard-reachable points where interactive; no information in
   hover only.

---

## 3. Applications

For each surface: what the brand does, what must be on it, what is forbidden,
and the approval tier from §8.

| Surface | Brand job | Required elements | Forbidden | Tier |
| --- | --- | --- | --- | --- |
| **Product (app)** | Disappear into calm; show source and status | Status vocabulary, source chips, AI label, designed failure states | Brand flourish near warnings/consent; urgency patterns; mascot | 1 (component) / 2 (new status or AI copy) |
| **Website** | Explain the next step and the status of everything | Product status map on any capability page; "Illustrative demo data" on screenshots; privacy/AI links | Roadmap as live; testimonials/logos (`CLM-013`); price as live (`CLM-015`) | 2 |
| **Trust centre** | Evidence, dated and scoped | Control, scope, revision, date, *gaps*; claim IDs internally | "Secure", "compliant", certifications not held (`CLM-010`) | 2–3 |
| **Sales** | Honest scoping: pilot beside systems | Pilot conditions in the same view as the offer; status of each integration as `CLM-005` allows | Replacement framing; ROI figures; named references | 2–3 |
| **Support** | Calm, specific, human route | Status sentence; named owner; next update time *only if operations can keep it* | Blame; "minor/isolated"; canned reassurance | 1 (templates) |
| **Institutional materials** | Procurement-grade evidence | Version, date, scope, owner; light ground; tables over imagery | Marketing gradients; unsupported compliance language | 3 |
| **Campaigns** | One idea, one next step | One claim from the approved library; the qualifier; where to read more | New claims; comparative claims against named firms; urgency | 2 |
| **Social** | Small, plain, useful | Alt text, captions, no text-in-image-only; disclosure on partner/paid | Engagement bait; guilt; student data; outcome claims | 1 (templates) / 2 |
| **Mobile stores** | Truthful listing | Icon, screenshots with demo-data label, privacy label that matches actual practice | Features not shipped; "native iOS/Android" if no binary | 3 |
| **Marketplace** | Make *who is speaking* unmistakable | Sponsored/partner/verified labels, provider identity, refund/dispute route | Any live listing before the gating conditions on the site are met | 3 |

**Notes on three surfaces**

- **Mobile stores.** No native iOS/Android project was found under `app/` at this
  commit (I did not search the whole repository), and the audit lists native
  clients as a target, not a fact. A store listing is a public claim about
  shipped software: **store assets are gated on a shipped, reviewed binary**, and
  the privacy label (Apple) and data-safety form (Google) must be derived from
  the actual data inventory by Privacy, not written by marketing.
- **Marketplace.** The site states no listings marketplace opens until publisher
  verification, moderation, accessibility standards, privacy rules, sponsorship
  labels, fraud reporting and an appeal process operate. The brand work here is
  design-ready (label system in B-33) but **not for launch**.
- **Sales vs. site.** The site's "Request the press kit" and partner "brand
  assets" imply a kit exists; I did not find one in the repository. See B-30.

---

## 4. Accessibility-safe brand rules and contrast requirements

*These are design requirements targeting WCAG 2.2 AA. They are not a conformance
claim: `CLM-008` prohibits one until a qualified assessment exists.*

### 4.1 The prime directive: brand never outranks status

Define four **brand-exempt zones.** In them, no campaign, tenant, theme,
gradient, glass, animation or display type may reduce legibility or change
meaning:

1. **Status and warnings** (errors, stale, pending, offline, denied, failed).
2. **Provenance** (source chips, the Source Line's label, AI labels).
3. **Consent, privacy and data-control text.**
4. **Accessibility controls and focus indication.**

Within them: body-grade type only (never Cinzel); contrast ≥ 4.5:1 for text and
≥ 3:1 for icons, borders and focus; the word is present, not just a colour or
glyph; visible without hover; **not animated away**, not dismissed by timer,
not hidden at any supported text size or zoom.

### 4.2 Numeric requirements

| Element | Requirement | Where measured |
| --- | --- | --- |
| Body and UI text | ≥ 4.5:1 | **Every** surface of the ramp, not the flattering one (`CLAUDE.md`) |
| Large text (≥ 24 px, or ≥ 18.66 px bold) | ≥ 3:1 | Same |
| Non-text (icons, input borders, chart marks, focus ring) | ≥ 3:1 vs adjacent colour | Same |
| Faint rung (app) | Hairline/decorative **only**; ≈ 3.3–3.7:1 measured | Same |
| Brass text | Dark grounds: base stop. Light grounds: **shade** stop only | `tokensFor` |
| Warning colour | ≥ 4.6:1 on every surface of its ground | `warnFor` |
| Text over images | ≥ 4.5:1 at the worst pixel region, via solid scrim | Per asset |
| Focus indicator | ≥ 3:1 vs adjacent, not obscured by sticky UI | Per component |
| Touch target | 44 px ordinary | Existing |
| "Increase contrast" mode | Brand assets must stay legible when the floor is raised | Per template |

Re-measure when a ground, accent or surface changes: `contrast.test.ts` walks 143
accent×ground pairings; marketing templates must be checked against the same
grounds they will sit on, in **light and dark**.

### 4.3 Colour is never alone

Status, series, required fields, links in running text and selected state each
carry a second signal (word, glyph, underline, pattern, position).

### 4.4 Assets

Alt text written at production; logo alt = "Semester"; decorative images have
empty alt; PDFs are tagged with a reading order and document language; video has
captions and transcript; no text embedded in images without the same text in
the page; documents use real headings and tables, not layout tables.

### 4.5 Language and cognition

Plain language; one idea per sentence; the status sentence (§1.7); no idiom that
fails in translation; dates written unambiguously ("3 Oct 2026"); no countdown
timers or false scarcity; consent asked one decision at a time.

### 4.6 Known gap: scripts

The 12 font files cover Latin and Latin-Extended. Greek, Cyrillic, Arabic, Hebrew,
Devanagari and CJK text will fall back to system fonts, which breaks the
look-and-feel promise **and** may break rhythm, size and weight rules. Backlog
**B-07** decides the fallback stack and tests it. Do not publish
non-Latin-script collateral until it does.

---

## 5. Art direction

### 5.1 Two experiences, one identity

| | **Student-facing** | **Institution-facing** |
| --- | --- | --- |
| Feeling | Calm, personal, capable | Rigorous, candid, procurement-ready |
| Ground | Student's choice; show Ink *and* Parchment | Light ground (Paper/Parchment) for documents; dark for demos |
| Density | Low; one next step above the fold | High where evidence needs it: tables, status maps, diagrams |
| Imagery | Documentary photography of working moments; abundant whitespace | Diagrams, annotated screens (demo data), none emotive |
| Display type | Cinzel for one statement per page, large | Cinzel sparingly; Barlow Condensed headings carry the load |
| Signature | Source Line on a single fact | Source Line on every claim row; status map as a layout |
| Motion | Minimal; settle-in only | None in documents; muted in demos |
| Tone | "Here is your next step." | "Here is the scope, the status, and the gaps." |

**Student-facing principles:** one next action; no guilt mechanics; encouragement
is specific ("You've added all four syllabi"), never relative to peers; breaks and
quiet states are first-class.

**Institution-facing principles:** lead with scope and status; show the limit next
to the capability; use the product-status map (use now / needs a pilot / later)
as a recurring layout; let a reviewer find the evidence behind any sentence.

**Two further registers, briefly.** *Guardian:* the consent boundary is the hero;
state what is shared, with whom, since when, and how to revoke. *Faculty/staff:*
workflow density; authority scope is always visible; no copy that suggests the
tool judges them.

### 5.2 Composition sketches

```
Student landing                       Institution one-pager
+-----------------------------+       +-----------------------------------+
| [mark] Semester     Sign in |       | [lockup]        Pilot overview v1 |
|                             |       | Scope · Status · Owner · Date     |
| Turn your semester into     |       |-----------------------------------|
| one clear next step.  (Cinzel)      | Use now | Needs a pilot | Later   |
|                             |       |  ...table, source line per row... |
| [Primary action]            |       |-----------------------------------|
| ───●  Official · Registrar  |       | What stays official. What we do   |
|      (Source Line + chip)   |       | not claim. Evidence index.        |
| Demo data — illustration    |       | [Gaps stated in the same view]    |
+-----------------------------+       +-----------------------------------+
```

### 5.3 Review rule

Anything visual is reviewed **as a rendered screenshot in the actual
environment**, not from tokens (`CLAUDE.md`: "a dark rectangle is a failure to
launch, not a dark theme"). The `run` skill documents how to drive the app.

---

## 6. Narrative guidelines: AI, privacy, trust, outcomes

Each block gives the stance, the sentence patterns, and the claim IDs it must
never exceed.

### 6.1 AI

**Stance:** assistive, source-linked, reviewable, interruptible. A tool, not a
person.

| Say | Don't say |
| --- | --- |
| "Ask Semester drafts a plan from the sources you gave it. Review it before you use it." | "Your AI advisor", "Semester knows you" |
| "AI-assisted, source-linked." (the existing label) | "AI-powered", "intelligent" |
| "It can be wrong. Check the source linked beside each answer." | "Accurate", "trusted answers", "no hallucinations" (`CLM-012`) |
| "High-stakes actions need your confirmation." | "Handles it for you" |
| "Your school may restrict or switch off assistive features." | "Works the same everywhere" |

**Rules:** label AI output where it appears; never present AI-derived content as
official; high-impact decisions are human-confirmed; no persona, name or face;
disclose synthetic voice; state data path and provider *only* once Privacy has
confirmed them for that feature (`CLM-011` requires "exact feature/provider/data
path and limitations"). No claims of "no training", "zero retention" or "private"
(`CLM-012`).

### 6.2 Privacy and data

**Stance:** the student decides; say what is held, why, for how long, and how to
leave. Use the owned term **Student Data Agency**, with its definition.

- Local-first is true for device persistence and export; account sync is
  **conditional** (`CLM-002`) and must be described with its qualifier.
- Prefer verbs and objects to adjectives: "You can export or delete your data"
  beats "Your data is safe".
- Never write "secure", "private", "compliant", "FERPA-approved", "COPPA-safe",
  "GDPR-ready" (`CLM-010`). State the *control* and the *scope* instead.
- Guardian and institution access is described as consent- and policy-bound, with
  the actual boundary written out.

### 6.3 Trust

**Stance:** *Trust by Design* as defined in `vocabulary.ts` — every promise is a
line a test or a register holds, and every gap is disclosed where the promise is.

- Put the **limit beside the capability**, in the same view, at the same size.
- Date everything evidential. Evidence expires; so do claims (the register's
  withdrawal rule).
- Candour is a feature: "Not yet available", "Pilot only", "Planned" are
  first-class labels, not apologies.

### 6.4 Educational outcomes

**Stance:** describe what a student *can do*, never what they *will achieve*,
until an approved measurement says otherwise (`CLM-014`).

| Allowed now (subject to register review) | Prohibited today |
| --- | --- |
| "See your deadlines in one place." "See which requirement a course covers." | GPA, retention, graduation, wellbeing, time-saved, ROI, efficiency |
| "Designed to help you organise tasks and plans." (`CLM-001`) | "Students who use Semester earn higher grades" |

**When evidence arrives**, an outcome statement must carry: the measured quantity,
baseline, sample size, period, method, limitations, whose data and under whose
authority, the customer's written approval, and an expiry. A template is in §7.7.
Testimonials, student quotes and named institutions need explicit consent and
the register's rights-holder approval (`CLM-013`). Disclosure and endorsement
rules are a matter for counsel.

---

## 7. Content templates

Placeholders are in `[square brackets]`. **Every template is Tier 1 for its
structure; any new claim inside it escalates per §8.**

### 7.1 Launch (feature or programme)

```
Title:        [Plain noun phrase]  — [status: Private beta | Pilot | Available]
Status line:  Status: [exact status]. Available to: [exact audience]. Not available: [exclusions].
What it does: [One sentence, action-first, source named.]
What you need:[Account/consent/integration required.]
How it uses data: [What is read, where it is stored, who can see it.]  [Link: privacy]
AI involved?: [No | Yes — what it drafts, how to review, how to turn off.]
What we haven't done: [Known limits and open items, same size as above.]
Accessibility: [What was tested, how, and known gaps — no conformance claim.]
Get help:     [Route, owner, hours *only if staffed*.]
Claim IDs:    [internal — CLM-xxx list; approval record link]
```

Do not date a launch the company has not committed to (`CLM-017`).

### 7.2 Product update ("what changed")

```
[Date] — [Version/area]
Changed:   [Plain verb + object. One line each.]
Why:       [The student problem, in one sentence.]
Affects:   [Who, and what they need to do — often "nothing".]
Not changed: [Anything people might assume changed.]
Behaviour you may notice: [Moved controls, changed defaults, new consents.]
Defaults: [If a default changed, say so first and how to revert.]
```

Never bury a data-use or permission change inside a product update; it gets its
own notice and Privacy review.

### 7.3 Incident communication

Aligned with [`INCIDENT-RECOVERY-PLAYBOOK.md`](INCIDENT-RECOVERY-PLAYBOOK.md); the
playbook governs process, this governs words.

```
[Status: Investigating | Identified | Monitoring | Resolved]   [Date, time, time zone]
What is affected:     [Exact functions. Exact audiences.]
What is NOT affected: [Only if verified.]
What it means for you: [Plain consequences; deadlines/data at risk.]
What you can do now:  [Workaround, official or human route.]
What we know / don't know: [Two short lists. Do not guess.]
Next update:          [Time — only if operations can keep it.]  [Status page link]
Resolved:             [What was fixed; what to check; what remains open.]
```

**Rules:** no "minor", "isolated", "small number", "out of an abundance of caution",
"we take security seriously" — unless quantified and verified; no blame; no
speculation about cause; the status page is the single source of truth. **Any
event that may involve personal data goes to Security, Privacy and counsel
*before* wording is finalised; notification duties and timing are legal
decisions, not brand decisions.**

### 7.4 Onboarding

1. **Orient:** "Semester starts with what you have. Pick one: add a syllabus,
   connect a calendar, or use sample data."
2. **First win:** show one real next step, with its source label.
3. **Consent, one at a time:** each ask states what, why, how long, how to undo.
   Decline is a clear, equal-weight option and never degrades the core
   experience unless the feature needs the data.
4. **Where things are:** the five destinations; where to find status and help.
5. **No streak, no points, no guilt.** Skip is always available.

### 7.5 Lifecycle messages

| Message | Trigger | Rule |
| --- | --- | --- |
| Welcome | Account created | Names the next step; one link; no feature tour |
| Nudge (start-time) | Student-set or student-approved | Student chooses the cadence; says why it was sent |
| Stale source | Connection older than the stale window | Status sentence; one action |
| Term transition | Term boundary | Offers export and archive; never urgency |
| Win-back | Inactivity | At most one; honest; unsubscribe is one click |
| Account deletion | User request | Confirms scope and recovery path; no persuasion |

Transactional and marketing messages are separate streams with separate consent.
Suppression lists, frequency caps and unsubscribe handling are owned by Marketing
Operations; student data never enters a lead or campaign tool. Messages to
minors or guardians are subject to the privacy/age policy; counsel decides
the lawful basis.

### 7.6 Community

- **Welcome:** states the guidelines in five lines and where to report
  ([`COMMUNITY-GUIDELINES-DRAFT.md`](legal-drafts/COMMUNITY-GUIDELINES-DRAFT.md)).
- **Moderation notice:** *what happened* (the content, neutrally) → *which rule*
  → *what changed* → *how to appeal*. No tone of accusation.
- **Moderator voice:** same voice as the product; no humour at a person's expense;
  safety reports are acknowledged by a human route
  ([`COMMUNITY-MEDIA-SAFETY.md`](COMMUNITY-MEDIA-SAFETY.md),
  [`CAMPUS-MODERATION-SOP.md`](CAMPUS-MODERATION-SOP.md)).
- **Ambassadors:** disclosed as ambassadors; briefed on §1.7 and the register;
  cannot make claims beyond approved copy.

### 7.7 Outcome statement (only when evidence exists)

```
Measured:    [Quantity] for [population] over [period].
Baseline:    [How measured, by whom.]
Result:      [Number with uncertainty.]  n = [ ].
Method:      [Design; what it cannot show — e.g. no causal claim.]
Authority:   [Whose data; written approval reference; expiry date.]
Qualifier:   [Verbatim sentence that must appear with the number.]
```

---

## 8. Governance and approval

### 8.1 Principle

The brand does not make claims; **the register does.** Brand review checks form
(identity, accessibility, voice). Claim review checks truth. A piece can pass
the first and fail the second; both are required.

### 8.2 Approval tiers

| Tier | Covers | Approver (function) | Evidence required |
| --- | --- | --- | --- |
| **0 — Pre-approved** | Existing approved copy and templates reused unchanged | Author self-checks against checklist (§8.5) | Template/claim ID cited |
| **1 — Brand + owner** | New layout or asset that makes **no** new claim | Brand owner + content owner | Contrast report; alt text; label check |
| **2 — Claims review** | Any sentence not in the approved library; any status, AI, privacy or integration reference | Product + Privacy/Security/Accessibility as applicable + claim-owner | Register row, evidence link, expiry |
| **3 — Counsel and rights-holder** | Compliance language, certifications, outcomes, named institutions or people, pricing, contractual terms, mobile-store listings, marketplace | Qualified counsel + the above + rights-holder/customer | Written approvals; the register's approval record |

Counsel approves legal conclusions and contracts; nothing here substitutes for it.

### 8.3 Roles (functions, not people)

| Function | Owns |
| --- | --- |
| Brand owner | This document, the asset registry, the identity tests |
| Claim owner | The register, approval records, withdrawal |
| Accessibility owner | Contrast and assistive-technology review of brand assets |
| Privacy owner | Data statements, store privacy labels, consent copy |
| Security owner | Trust-centre statements, incident wording gate |
| Content owner | Voice, templates, term vocabulary |
| Support owner | Incident and support templates |
| Legal | Via qualified counsel only |

**Current state:** the register names Harrison Rubin as claim-owner and
legal-coordination primary and records counsel and specialist approvers as
**unassigned**. Until they are assigned, **Tier 2 and Tier 3 content cannot
lawfully be treated as approved**; the register's default (do not publish)
governs. That is a launch-gating finding, not a process footnote.

### 8.4 Change control

- **Versioning:** the brand is versioned (this file's header); asset files carry
  version and checksum, extending the existing `SHA256SUMS` practice.
- **Identity parity is a test, not a promise:** `companysitebrand.test.ts` already
  holds logo geometry, fonts and favicon byte-equal between app and site. Any new
  asset class (e.g. social avatars, store icons) joins that test or is not
  "official" (B-02).
- **Deprecation:** a deprecated asset moves to an `archive/` path with a
  superseded-by note; it is removed from every channel (the withdrawal rule),
  logged, and its expiry honoured.
- **Expiry:** every approved claim has an end date; a claim past its date is
  withdrawn, not renewed by default.
- **Partners and ambassadors:** written co-marketing approval; paid relationships
  always disclosed (existing rule); no use of the mark to imply endorsement.
- **AI-assisted creation:** AI-generated copy and images follow the same tiers;
  an AI draft is never a source of facts; generated imagery rules in §2.5.
- **Takedown:** any contradicted or over-broad public statement is removed from
  all channels first, then analysed; a material false claim escalates to
  legal/security/privacy/customer communication per the register.
- **SLAs for review turnaround are not set.** Setting one without capacity data
  would be an invented number; B-40 measures first.

### 8.5 One-page pre-publication checklist (Tier 0/1)

1. Every factual sentence maps to a claim ID with an unexpired approval, or it is
   not a claim.
2. No word from the "avoid" list (§1.7) without an approved qualifier.
3. Status/provenance/consent/accessibility elements present, unstyled by brand,
   and legible (§4.1).
4. Contrast measured on **both** a dark and a light ground; screenshot reviewed.
5. Colour never alone; alt text; captions; reading order.
6. Demo data labelled; illustration labelled; no real student data.
7. No institution, person or logo without written approval.
8. Dates are exact; nothing is described as live that the status map says is not.

---

## 9. Competitive visual differentiation

**Caveat.** This describes *category conventions* as I understand them. I did not
re-check any competitor's current identity in this session, and the repository's
own competitor documents ([`COMPETITION.md`](../COMPETITION.md),
[`MARKET-POSITION.md`](../MARKET-POSITION.md)) analyse features, not visuals.
Re-verify against live products before external use. No comparative visual claim
about a named company may be published.

### 9.1 Category conventions

| Category (examples the repo itself names) | Typical visual code | What it signals |
| --- | --- | --- |
| LMS (Canvas, Brightspace) | Institutional colour, dense lists, form-heavy | Administrative, obligatory |
| Productivity/notes (Notion) | White canvas, soft pastel, emoji | Flexible, personal, light |
| Study apps | Saturated colour, mascots, streaks | Motivational, playful |
| General AI assistants | Gradients, glow, sparkle, chat bubbles | Magic, intelligence |
| Campus/engagement apps | School-colour skins, stock photography | Belonging, institutional |
| Ed-tech SaaS marketing | Purple/teal gradients, hero stock photo, cap/book/lightbulb icons | Generic "innovation" |

### 9.2 Where Semester sits

| Dimension | Category default | Semester |
| --- | --- | --- |
| Metaphor | Magic, game, or form | **Instrument and archive** |
| Colour | Saturated brand colour or white | **Graphite, Brass, Sterling**; user-chosen grounds |
| Type | One friendly sans | **Roman display + condensed utility + text sans** |
| Imagery | Stock students, mascots | **Diagrams, documentary photography, the Source Line** |
| Status | Hidden or decorative | **Status is a visible, designed part of the product** |
| Motion | Delight, confetti | **Calm; zero under calm/reduced motion** |
| Trust display | Badges and logos | **Dated evidence and stated gaps** |

The distinctiveness is *functional*, not ornamental: the strongest visual
differentiator is the status/provenance system, because a competitor can copy a
palette in a day and cannot copy a product that actually carries sources.

### 9.3 Risks to test (not yet tested)

| Risk | Why | Mitigation to test |
| --- | --- | --- |
| Graphite + Brass reads as private banking or luxury, not as student-friendly | Metallic, restrained, dark | Show Parchment and Paper grounds first in student contexts; warm documentary photography |
| Cinzel reads as law firm or classical formality | Roman capitals | Limit to one statement per page; pair with plain Barlow copy |
| Dark default reads as "tech" to institutional buyers who read on paper | Procurement is document-driven | Light-ground institutional templates (B-24) |
| Chrome mark loses the metallic effect and reads grey on small or light surfaces | Gradient dependence | Flat/one-colour variants in B-01; test at minimum sizes (B-04) |
| Brass on light fails contrast | 1.59:1 | Shade stop rule (§2.2) enforced in templates |

**Proposed test (not run):** a five-second recall and impression test across a
sample of students and of institutional buyers; sample size and method to be set
by Research. No result exists, and none should be cited until one does.

---

## 10. Brand asset production backlog

Priority: **P0** gates any public campaign; **P1** before wider pilot outreach;
**P2** later. "Gate" is the §8 tier required to publish. Acceptance criteria are
written to be checkable.

### Foundation

| ID | Asset | P | Owner | Acceptance | Gate |
| --- | --- | --- | --- | --- | --- |
| B-01 | Logo master package: chrome tile, flat, lockup, one-colour, reversed (SVG + PNG ladder) | P0 | Brand | Generated from `mark.data.ts`; no hand-edited paths; one-colour has no gradient/edge shading | 1 |
| B-02 | Identity parity test extended to every new asset class | P0 | Eng + Brand | Fails when any asset's geometry/colour drifts; seen failing before the fix | 1 |
| B-03 | Clear-space and misuse sheet | P0 | Brand | Matches §2.1; every misuse example rendered | 1 |
| B-04 | Minimum-size proof | P0 | Brand + A11y | Rendered at 16/24/32/48 px on both grounds; legibility judged from screenshots; sizes in §2.1 confirmed or revised | 1 |
| B-05 | Brand tokens export (JSON/CSS) mirroring the six role names, with the contrast matrix | P0 | Design Systems | Every pair listed with ratio; matrix regenerated by script, not typed | 1 |
| B-06 | Contrast matrix for all marketing templates on Ink and Parchment | P0 | A11y | Every text/background pair ≥ rules in §4.2; light **and** dark | 1 |
| B-07 | Non-Latin script fallback stack | P1 | Design Systems + A11y | Decision recorded; Greek/Cyrillic/Arabic/CJK samples rendered and reviewed | 1 |

### Verbal

| ID | Asset | P | Owner | Acceptance | Gate |
| --- | --- | --- | --- | --- | --- |
| B-10 | Approved-copy library keyed to claim IDs | P0 | Claim owner | Every line has ID, channel, expiry; tests refuse lines with no ID | 2 |
| B-11 | Register row `CLM-018` (source-aware presentation) drafted with scoped evidence | P0 | Claim owner + Eng | Evidence lists the surfaces where the ladder is actually rendered; unused labels excluded | 2 |
| B-12 | Tagline decision memo (T1–T6) | P1 | Brand | Each tagline carries its approval record or is dropped; a decision file `docs/decisions/D-<PR number>.md` | 2 |
| B-13 | Voice and words guide (one page) + banned/qualified phrase list | P0 | Content | Machine-checkable list used by a copy lint | 1 |
| B-14 | Copy lint over site and product strings for §1.7 phrases | P1 | Eng | Seen failing on a seeded violation; control phrase passes | 1 |
| B-15 | Content templates (§7) as reusable modules | P1 | Content | Each template has required fields enforced | 1 |

### Visual kits

| ID | Asset | P | Owner | Acceptance | Gate |
| --- | --- | --- | --- | --- | --- |
| B-20 | Source Line component spec + Figma/code parity | P0 | Design Systems | Cannot render without a source label; keyboard/screen-reader name = the label | 1 |
| B-21 | Audit of faint-rung usage (59 references / 19 files) | P0 | A11y + Eng | List of text uses that fall below 4.5:1, each fixed or justified | 1 |
| B-22 | Illustration kit (slabs, lines, nodes, flow diagrams) | P1 | Brand | Two accents max; no banned subjects; labelled illustration | 1 |
| B-23 | Data-viz kit | P1 | Design Systems | Greyscale-distinguishable; direct labels; source/date/demo-label slots; table alternative | 1 |
| B-24 | Institutional light-ground templates (deck, one-pager, proposal, letterhead, trust-centre PDF) | P0 | Brand | Tagged PDFs; reading order; contrast measured; status map layout | 2 |
| B-25 | Student-facing templates (social, email, landing modules) | P1 | Brand | Alt-text and caption slots required | 1 |
| B-26 | Photography brief, shot list, release forms, caption rules | P1 | Brand + Legal | Releases collected before use; guardian consent path | 3 |
| B-27 | Motion kit: logo-once, transitions, reduced-motion equivalents | P2 | Design Systems | Each has a static equivalent; no flash > 3/s | 1 |

### Channels

| ID | Asset | P | Owner | Acceptance | Gate |
| --- | --- | --- | --- | --- | --- |
| B-30 | Press and partner kit (the site refers to one) | P1 | Brand + Claim owner | Verified whether one exists; if not, built from approved copy only | 2 |
| B-31 | Partner tier badges (Registered / Verified / Strategic) | P2 | Brand | Issued only after the tier's review passes; revocation rule written | 3 |
| B-32 | Mobile store assets (icon, screenshots, listing, privacy mapping) | P2 | Brand + Privacy | **Gated on a shipped binary**; privacy label derived from the data inventory | 3 |
| B-33 | Marketplace label system (sponsored / partner / verified / provider) | P2 | Design Systems | Design-ready only; not for launch until the site's conditions operate | 3 |
| B-34 | Status page and incident templates (§7.3) in the status surface | P0 | Support + Eng | Fields enforced; banned phrases blocked | 1 |
| B-35 | Trust-centre visual layout (control, scope, revision, date, gap) | P0 | Brand + Security | Every row has a date and a stated gap | 2 |

### Accessibility, governance, research

| ID | Asset | P | Owner | Acceptance | Gate |
| --- | --- | --- | --- | --- | --- |
| B-36 | Alt-text library and caption/transcript standard | P0 | A11y | Every shipped asset has alt or marked decorative | 1 |
| B-37 | Brand-exempt-zone component tests (status, provenance, consent, a11y controls) | P0 | Eng | Tenant theme and campaign skin cannot alter them; seen failing on a deliberate override | 1 |
| B-38 | Asset registry (ID, version, checksum, owner, expiry, approval link) | P0 | Brand | Every published asset registered; expired assets flagged | 1 |
| B-39 | Withdrawal runbook for brand assets and claims | P0 | Claim owner | Dry-run executed once; time to remove from all channels recorded | 2 |
| B-40 | Review-capacity measurement (before setting any SLA) | P1 | Ops | Real turnaround recorded for a month before a target is set | 1 |
| B-41 | Perception test (student and institutional buyers) | P2 | Research | Method and sample recorded; findings never cited beyond their scope | 1 |
| B-42 | Trademark clearance request to counsel | P0 | Legal | Counsel's written result; filed in the IP inventory | 3 |

**Progress, 2026-10-04 (draft; nothing here is approved).**

| ID | State | What was done, and what is still open |
| --- | --- | --- |
| B-10 | Delivered as a draft | A copy-level register already existed (`M-01`–`M-36`, §8 of [`BRAND-AND-MARKETING-STRATEGY.md`](gtm/BRAND-AND-MARKETING-STRATEGY.md)), so no second library was built. Added brand-line rows `M-37`–`M-44`, split the unsupported "every fact" sentence out as prohibited `M-09b`, recorded `D-1148` against `M-26`/`D1`, and added `app/src/lib/gtm/copyregister.test.ts` (six rules, each seen failing). It found three rows whose review date disagreed with their risk (`M-08`, `M-14b`, `M-21`); their risk was raised to match the earlier date. **Open:** moving the register into `ops/claims` data, which the strategy proposes |
| B-11 | Delivered as a draft | `CLM-018` added as **proposed, not approved**, with [`CLM-018-SOURCE-LABEL-EVIDENCE.md`](CLM-018-SOURCE-LABEL-EVIDENCE.md) and `app/src/lib/ops/clm018.test.ts` (five assertions, each seen failing). **Open:** four components print "Institution verified" unconditionally; Product and Engineering must confirm the data path before approval |
| B-42 | Request drafted | [`TRADEMARK-CLEARANCE-COUNSEL-REQUEST-DRAFT.md`](legal-drafts/TRADEMARK-CLEARANCE-COUNSEL-REQUEST-DRAFT.md). **No clearance search was run and no counsel has been engaged.** The USPTO site answers from this environment, but programmatic search did not work (HTTP 405) |
| B-39 | Procedure drafted; **not complete** | [`CLAIM-WITHDRAWAL-RUNBOOK.md`](CLAIM-WITHDRAWAL-RUNBOOK.md), the log in [`claim-withdrawals/`](claim-withdrawals/) and `app/src/lib/gtm/withdrawal.test.ts`. A dry run of the search steps found the withdrawn "every fact" sentence **still live on the public site** (7 instances, 3 files); that entry is `OPEN`. **Time to remove from all channels is not yet measured**, which B-39's acceptance requires |
| B-12 | Memo drafted; **awaiting the owner's decision** | [`TAGLINE-DECISION-MEMO.md`](TAGLINE-DECISION-MEMO.md) and `app/src/lib/gtm/taglines.test.ts`. Findings: T1 and T5 are already live on the public site; T4 ("not instead of them") contradicts the site's own "takes each one over" copy and `D-1067`; T2, T3 and T6 are broader than their evidence. Recommends keeping T1 and T5, revising T4 and T6, holding T2 and T3. No decision file yet: it takes its pull request's number once the owner decides |

**Order of work.** B-42, B-10, B-11 and B-39 first: they decide *what may be said
and who may say it*. Then B-01–B-06, B-21, B-34–B-38. Everything visual that
depends on a claim waits for the claim.

---

## 11. Shared-preamble outputs

### Assumptions

1. The existing identity (§0.2) is intended and stays; this is codification and
   extension, not a rebrand.
2. The register is current as of its 2026-10-03 assessment date.
3. "Student OS" is an internal category label, not a public descriptor; the public descriptor is "student action platform" (`D-1148`).
4. Brand work is subordinate to the register: the brand does not decide claims.
5. No audience research, trademark search or live competitor review was performed.

### Risks and unresolved questions

| # | Risk or question | Owner needed |
| --- | --- | --- |
| 1 | Approvers beyond the claim-owner are unassigned, so Tier 2/3 cannot operate | Founder |
| 2 | ~~Public descriptor~~ — **resolved 2026-10-04**: keep "student action platform" (`D-1148`). Revisit only through the register | — |
| 3 | Trademark clearance for "Semester" and product names is unknown | Counsel |
| 4 | Faint rung ≈ 3.3–3.7:1 in the app; extent of text use unmeasured (B-21) | A11y |
| 5 | Non-Latin scripts unsupported by shipped fonts (§4.6) | Design Systems |
| 6 | The "press kit" and partner "brand assets" the site mentions were not found in the repo | Brand |
| 7 | Provenance states `official`, `faculty-approved`, `course-provided`, `updated-today` not rendered today; brand must not imply they are | Product |
| 8 | Graphite/Brass/Cinzel perception is untested (§9.3) | Research |
| 9 | The audit's thesis and `CLM-006` conflict; this document resolves it toward the register | Founder to confirm |

### Files changed

- Added `docs/BRAND-PLATFORM.md` (this file). No application code, tokens, fonts
  or assets were changed.

### Tests added

**None.** This is a documentation change. Proposed guards are B-02, B-14, B-21,
B-37; each must be seen failing before being trusted (`CLAUDE.md`). I did not run
the repository's suite: dependencies are not installed in this checkout, and the
only numbers in this file that are not quoted from the repository are the contrast
ratios I computed, which are marked as such.

### Accessibility implications

§4 sets the rules; they target WCAG 2.2 AA as a *design* requirement and make no
conformance claim (`CLM-008`). Named gaps: faint rung, non-Latin fonts, minimum
logo sizes unverified.

### Security and privacy implications

None to code. Brand rules constrain data use in content: no student data in
leads, campaigns, screenshots or testimonials; self-hosted fonts avoid
third-party requests; store privacy labels derive from the data inventory; the
incident template routes personal-data events to Security, Privacy and counsel
before wording.

### Operational and runbook implications

New: asset registry (B-38), withdrawal runbook (B-39), copy lint (B-14), brand-exempt
zone tests (B-37). Review capacity is unmeasured; no SLA is promised (B-40).

### Traceability

| Brand rule | Source | Claim IDs touched | Guard (existing → proposed) |
| --- | --- | --- | --- |
| One identity across app and site | `mark.data.ts`, `site.css` | — | `companysitebrand.test.ts` → B-02 |
| No replacement language | register | `CLM-005`, `CLM-006` | `salecopy.test.ts` (scope unverified by me) → B-14 |
| No unqualified security/compliance words | register | `CLM-010` | → B-14 |
| AI is assistive, labelled, never absolute | register, trust cues | `CLM-011`, `CLM-012` | → B-14, B-37 |
| Outcomes withheld until measured | register | `CLM-014` | → B-10 |
| Status/provenance never restyled | design guide, trust cues | `CLM-007`, `CLM-009` | `where.test.ts` → B-37 |
| Contrast on every surface | `COLOR-AND-DARK-MODE-SPEC.md` | `CLM-008` | `contrast.test.ts` → B-06 |
| Owned terms stay with their pages | `vocabulary.ts` | — | `vocabulary.test.ts` |
| Named institutions/logos prohibited | register | `CLM-013` | → B-38 |
| Price and availability labelled "planned" | register | `CLM-015` | `salecopy.test.ts` |
