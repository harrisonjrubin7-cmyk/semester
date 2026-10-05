# Master design brief — crosswalk to what exists

> Status: **index and gap list.** The brief asks for 19 deliverables. Most already exist in this repository as governed documents backed by code and tests, and the Claude Design handoff kit holds a second, prototype-grade copy. Writing a parallel set would create two visual grammars, which is what the brief forbids. This page says where each deliverable lives, what is missing, and which new files fill the gaps.

**Authority order is unchanged** (`CLAUDE.md`, `docs/design-system/README.md`): `app/src/lib/look.ts` → `app/src/styles/tokens.css` → `lib/tokenexport.ts` → `app/design-tokens/semester.tokens.json` (generated) → docs → Figma. The handoff kit is *evidence of design intent*, like Figma. Where it differs from the app (the kit uses Barlow Condensed on buttons; the app's type roles are `--type-role-*`), the app wins.

## 1. The 19 deliverables

| # | Deliverable | Where it lives | Status |
|---|---|---|---|
| 1 | Master visual language | `docs/design/SEMESTER-UI-CONSTITUTION.md`, `docs/BRAND-PLATFORM.md`, `docs/design/UNIFIED-SEMESTER-SYSTEM.md`; kit `guidelines/` | Exists |
| 2 | Semantic token system | `app/src/styles/tokens.css`, `docs/DESIGN-TOKEN-ARCHITECTURE.md`, `docs/DESIGN-TOKENS.md`; export checked by `npm run tokens:check` | Exists, enforced |
| 3 | Typography | `docs/TYPOGRAPHY-SYSTEM.md`; `--type-role-*`; `lint:styles` | Exists, enforced |
| 4 | Spacing / layout | `docs/design/LAYOUT-CONTRACT.md`, `RESPONSIVE-CONTRACTS.md`; `styles/{breakpoints,gutter,taps,density}.test.ts` | Exists, enforced |
| 5 | Colour / status | `lib/look.ts` (13 grounds, 11 accents), `docs/COLOR-AND-DARK-MODE-SPEC.md`, `docs/design/STATUS-SOURCE-VISUAL-LANGUAGE.md`, `lib/status.ts`; `lib/contrast.test.ts` | Exists, enforced |
| 6 | Motion | `docs/MICRO-INTERACTION-SYSTEM.md`; `--motion-*`, `--duration-*`, `--ease-*`; `a11y/motion.test.ts` | Exists, enforced |
| 7 | Iconography | `components/Icons.tsx`, `icons.data.ts` (108 shapes), `scripts/icons.mjs`, `lint:labels`; kit `guidelines/iconography*.html` | Exists |
| 8 | Navigation | `lib/nav.ts`, `lib/tabbar.ts`, `components/nav/*`, `docs/design/RESPONSIVE_SHELL_AUDIT.md`; five destinations | Exists; Rail/TabBar still inline in `App.tsx` (extraction planned, D2) |
| 9 | Universal page shell | `docs/design/LAYOUT-CONTRACT.md`, `components/Page.tsx`, kit `PageHeader` | Exists |
| 10 | Trust / source / freshness | `lib/source.ts`, `docs/TRUST-CUES-AND-SOURCE-PRESENTATION.md`, spec §4 (five axes) | Exists, enforced: `components/SourceBadge.tsx` draws glyph + word + meaning (`SourceBadge.test.tsx`); `COMPONENT_INVENTORY.md` still says word-only, and is stale on that row |
| 11 | Workflow state | `docs/design/INTERACTION-STANDARDS.md` §3–4, `unity/DecisionTrail.tsx`, `StepStatus` | Exists |
| 12 | Form and validation | `INTERACTION-STANDARDS.md`, `components/FieldMessage.tsx`, `a11y/fielderror.test.ts` | Exists; `TextField` wrapper is "New" in the inventory |
| 13 | AI answer / citation / uncertainty | `docs/ai-governance/09-user-transparency.md`, `STATUS_AND_PROVENANCE_AUDIT.md`, spec §5.5 | Exists: `intelligence/Disclosure.tsx` is the answer receipt (AI-assisted badge, evidence, information used, uncertainty, policy) in both `ai/Chat.tsx` and `ai/Panel.tsx`; the human handoff was missing and is now `onAskHuman` |
| 14 | Responsive standard | `docs/RESPONSIVE-COMPONENT-SPEC.md`, `lib/media.ts` (600/840/1200/1600), `RESPONSIVE-CONTRACTS.md` | Exists, enforced |
| 15 | Accessibility standard | `docs/accessibility/*`, spec §6, `docs/WCAG-UI-AUDIT-SCORECARD.md`; `src/a11y/` tests | Exists; conformance is *not* claimed (spec §6.8) |
| 16 | Component library | `components/ui.tsx`, `components/unity/`, `gallery/stories.tsx`; inventory in `docs/design/COMPONENT_INVENTORY.md` | Exists, partial |
| 16a | **12-field spec per component** | **`COMPONENT-SPEC-MATRIX.md` (new)** | **Was missing** |
| 17 | Screen packs (7) | **`SCREEN-PACKS.md` (new)**; `docs/design/SCREEN-AUDIT.md`, `docs/master/SEMESTER_SCREEN_CATALOG.md` | **Was missing as a single answer to the seven questions** |
| 18 | Design QA checklist | `docs/design/SCREEN-QUALITY-CHECKLIST.md`, `COMPONENT-RELEASE-CHECKLIST.md`, spec §9 | Exists |
| 19 | Governance / contribution rules | `docs/design/GOVERNANCE.md`, spec §7, `CLAUDE.md` | Exists |

## 2. The brief's rules against the repository's own rules

| Brief says | Already true here | Conflict |
|---|---|---|
| Indigo/blue-violet primary | `--action-primary` from `look.ts` | Verify the hue per ground in `contrast.test.ts`; the kit calls it "Semester blue". Not changed here |
| Source, authority, freshness, policy, status labels | `lib/source.ts`, `lib/status.ts`, `PolicyBadge` | None |
| Progressive disclosure L1/L2/L3 | `PROGRESSIVE-DISCLOSURE-RULES.md` | None |
| Full capability parity across devices | `CAPABILITY-PARITY-MATRIX.md` | None |
| No hover-only controls, no colour-only status | `a11y/tellings.test.ts`, `taps.test.ts` | None |
| AI shows source, policy, limits, handoff | Receipt in `intelligence/Disclosure.tsx`; handoff added | One receipt, not one `AIResponse` component |
| No unsupported customer or compliance claims | `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` | The Pilot page and homepage must cite it |
| "Create a separate style per module: no" | One token source; ledgers may shrink, never grow | None |

## 3. Out of scope here, deliberately

- **Drawing 18 new screens in code or in Figma.** The Figma connector needs authorization this session cannot give, and `CLAUDE.md` forbids writing to Figma unless asked. Screens that do not exist in the app (§4 of `SCREEN-PACKS.md`) are for the owner to prioritise.
- **New shared components.** Any proposal needs the case in `GOVERNANCE.md` §2 and goes through `/create-semester-component`.
- **Changing tokens or `look.ts`.** Nothing here touches colour, type or spacing values.
- **Analytics collection.** Event names in the matrix are definitions only (D-005).

## 4. What would make this finished

1. Owner decides which of the five missing named screens to build first (Term Plan, Advisor Caseload, Tenant Overview, Operations Inbox, Pilot page).
2. Adopt `ActionPreview` (it has `whoCanHelp` now, but no screen uses it yet; 23 dialogs implement their own).
3. Wire the matrix's test requirements into the gallery stories (`gallery.test.tsx` already requires a story per component).
