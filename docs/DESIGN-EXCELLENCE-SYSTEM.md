# Design excellence system

The index for the design-excellence work: the semantic token layer, the shared
"platform unity" components, the status vocabulary, the workspace modes and the
standard states. Every document below describes what is in the code, with file
paths and values read from it. Where the brief asked for something that was
built differently or not built, the document says so in its own section.

## What it is for

The brief asks for an app that feels calm, precise, warm, academic, modern,
trustworthy and quietly powerful, and names what it must not feel like: a
generic LMS, an enterprise portal, a social feed, a neon AI dashboard, a
spreadsheet, a gamified productivity app, or a set of unrelated tools sharing a
login. Its unifying formula is the sentence a student should be able to say on
any screen:

> "I know where I am, what matters, where the information came from, what I
> can trust, and what I should do next."

Most of that was already true of Semester before this change — thirteen
contrast-tested grounds, a reader-controlled type and spacing system, a
provenance ladder in `app/src/lib/where.ts`, one focus ring, and a
reduced-motion setting of its own. This work is additive. It names what
existed (the semantic tokens), gives the recurring questions one answer each
(one status vocabulary, one Source & details drawer, one "About this screen",
one capture sheet), and adds the pieces the app did not have (workspace modes,
the command centre, first-session goal, the standard state components).

## How it shipped

One branch, `claude/zen-volta-snc6bk`, one draft pull request. The brief names
eight feature branches (phases 0–8); the session could push to one branch
only, so the phases are commits and sections of one PR rather than eight PRs.
[DESIGN-SYSTEM-MIGRATION-PLAN.md](DESIGN-SYSTEM-MIGRATION-PLAN.md) maps each
phase to what landed and what did not.

The shared components are not only built but placed: context bars on the
deadline, course hub, study guide, Study Studio's draft, Pathway and the
toolkit's assignment workspace; object cards in Career and University; Next,
the standard error, success, progress, step, permission and save states on
twenty-eight existing screen and component files; About this screen on every screen; and Quick
Capture behind the header's `+` on every screen.
[SEMESTER-PLATFORM-UNITY-PATTERNS.md](SEMESTER-PLATFORM-UNITY-PATTERNS.md#where-each-is-used)
has the full table. Plan, Research, Data, Community and Advising are not yet
reached.

## The documents

| Document | What it covers |
| --- | --- |
| [WCAG-UI-AUDIT-SCORECARD.md](WCAG-UI-AUDIT-SCORECARD.md) | The 0–3 scale, the dimensions, the component matrix scored from evidence, release thresholds |
| [DESIGN-TOKEN-ARCHITECTURE.md](DESIGN-TOKEN-ARCHITECTURE.md) | Primitive, semantic and component layers; the naming-collision rule; the migration rule |
| [DESIGN-TOKENS.md](DESIGN-TOKENS.md) | Every token in `tokens.css` with its value, and the primitive scales |
| [COLOR-AND-DARK-MODE-SPEC.md](COLOR-AND-DARK-MODE-SPEC.md) | Grounds, accents, tonal elevation, the warn colour, contrast testing, Match my device |
| [TYPOGRAPHY-SYSTEM.md](TYPOGRAPHY-SYSTEM.md) | Faces, scale, leading, reading width, tabular figures, and body at 16px |
| [ELEVATION-AND-GLASS-POLICY.md](ELEVATION-AND-GLASS-POLICY.md) | Surfaces, elevation tokens, the four places glass is allowed and their fallbacks |
| [MICRO-INTERACTION-SYSTEM.md](MICRO-INTERACTION-SYSTEM.md) | Motion tokens, the reduced-motion paths, the interaction matrix |
| [INFORMATION-HIERARCHY.md](INFORMATION-HIERARCHY.md) | The three questions, one primary action, card rhythm, progressive disclosure, calm density |
| [SEMESTER-PLATFORM-UNITY-PATTERNS.md](SEMESTER-PLATFORM-UNITY-PATTERNS.md) | Context bar, object card, Source & details, Next, Capture, status vocabulary, visibility, Open in — and where each is used |
| [TRUST-CUES-AND-SOURCE-PRESENTATION.md](TRUST-CUES-AND-SOURCE-PRESENTATION.md) | The provenance ladder, labels, freshness, AI presentation rules |
| [ONBOARDING-AND-CONTEXTUAL-HELP.md](ONBOARDING-AND-CONTEXTUAL-HELP.md) | First-session goal, existing onboarding, About this screen on every screen |
| [ACCESSIBILITY-POLISH-CHECKLIST.md](ACCESSIBILITY-POLISH-CHECKLIST.md) | The checklist, each item ticked or not, with evidence |
| [WORKSPACE-MODES.md](WORKSPACE-MODES.md) | Guided, Focused, Detailed, Accessibility; the presentation-only guarantee |
| [EMPTY-LOADING-ERROR-SUCCESS-STATES.md](EMPTY-LOADING-ERROR-SUCCESS-STATES.md) | Every state component and when to use which |
| [COMPONENT-RELEASE-CHECKLIST.md](COMPONENT-RELEASE-CHECKLIST.md) | The screen quality threshold and the release gates, as this repository runs them |
| [DESIGN-SYSTEM-MIGRATION-PLAN.md](DESIGN-SYSTEM-MIGRATION-PLAN.md) | Phases 0–8 against what landed; adoption order; compatibility |
| [DESIGN-REGRESSION-TEST-PLAN.md](DESIGN-REGRESSION-TEST-PLAN.md) | Every new or changed test and what it guards; manual and visual verification |
| [DESIGN-FEATURE-FLAG-PLAN.md](DESIGN-FEATURE-FLAG-PLAN.md) | Why no flags were added, proposed keys if wanted, rollback |

## Where the code is

| Layer | Files |
| --- | --- |
| Primitive tokens | `app/src/styles/app.css` (`:root`), `app/src/lib/look.ts` (`tokensFor`) |
| Semantic and component tokens | `app/src/styles/tokens.css` |
| Shared component styles | `app/src/styles/unity.css` |
| Shared components | `app/src/components/unity/*.tsx` |
| Vocabulary and small libraries | `app/src/lib/status.ts`, `lib/unity.ts`, `lib/explain.ts`, `lib/goals.ts`, `lib/widgets.ts` |
| Tests | `app/src/styles/tokens.test.ts`, `styles/glass.test.ts`, `lib/unity.test.ts`, `components/unity/unity.test.tsx`, `components/unity/rollout-a.test.tsx`, `rollout-b.test.tsx`, `rollout-c.test.tsx` |
