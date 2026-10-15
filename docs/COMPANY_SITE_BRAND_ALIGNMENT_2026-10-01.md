# Company-site brand alignment — 1 October 2026

## Scope and result

The existing company site in `company-site/` was aligned with the Semester
application in worktree `company-app-brand-match`, branch
`codex/company-app-brand-match`, starting from
`80fc459cf22c8fc2583ee02319012d5e13b5df7d`. This is a local, reviewable change;
it has not been deployed.

Public logos now use the application's canonical three-slab geometry. The site
ships the same 12 local font files, font stylesheet, SIL Open Font License and
favicon as the application. Graphite, Brass, chrome, restrained controls and
shared typography replace the earlier separate gold treatment. Product proof
occupies its own hero column and is explicitly labelled as an illustration
using demo data. Existing private-beta, planned-service, availability and
official-system boundaries remain visible.

Long reading passages use Barlow, utility headings use Barlow Condensed, and
Cinzel is reserved for display titles. No new brand or unsupported product
capability was invented. The asset checksum manifest covers the updated HTML
and newly local identity assets.

Menu and Search now isolate the background, return focus to their opener and
allow only one active modal. Selected navigation and tabs have stronger
indicators, and header targets have a 44px minimum. Compact-header treatment
preserves the footer's named brand link. The 90-day Status strip uses a
shrinkable grid after browser review exposed page overflow at 320px.

## Browser coverage

The source inventory contains 118 canonical company routes, including generated
solution and trust pages. Desktop and phone reviews covered all 118 routes at
each size (320px and 1439–1440px actual CSS width): expected rendered headings were present, with no page-width overflow
after the Status correction. Representative controls include the header,
Product illustration, Status history, Menu, Search, navigation and tabs.

Ten representative routes additionally passed at both 768px and 1024px:
Home, Product, Pricing, Contact, Brand, Status, Trust, Build My Semester,
Founder's Letter and Why Semester. Header/menu, shortcut search, Escape,
background isolation, scroll restoration and footer-opener focus return were
checked in the browser. Route and layout coverage does not prove every
data-dependent interaction, external form submission, account flow or
third-party integration. Invalid browser batches from the interrupted preview
are excluded from final evidence.

Screenshots and detailed logs live in the ignored `.ui-review/` directory and
are not versioned. This report is a review handoff, not a claim that all site
issues have been eliminated.

## Verification

Node 22.23.3 was used directly with the existing dependencies. Application types,
university types, oxlint, styles, labels, terms and the production build passed.
Oxlint reported 24 warnings, within the existing ceiling of 25.

Application bundle budgets passed: first load 435.3 KB of 479.0 KB; largest file
435.7 KB of 480.0 KB; 93 application routes. The canonical budget entry point in
this checkout is `app/scripts/budgets.ts`.

The final focused company-site run passed all 33 tests across five files.
Visual-identity, modal, Status, selection-indicator, touch-target and reading-
typography regression guards were observed failing before their corresponding
fixes, then passed. Asset equality and compact-wordmark checks protect the
application identity. Types and lint were rerun successfully after the final
guard additions.

The 12 font binaries, stylesheet and favicon match their app sources byte for
byte. One inherited trailing space was removed from the copied font license;
its complete text is otherwise unchanged and protected by the identity test.

| Broad run | Files | Tests | Duration |
| --- | --- | --- | --- |
| Full | 1,250 passed; 1 failed; 1 skipped | 19,516 passed; 1 failed; 51 skipped | 204.33 s |
| Shuffled, seed `1790900308921` | 1,249 passed; 2 failed; 1 skipped | 19,515 passed; 2 failed; 51 skipped | 240.94 s |

The full-run failure was the soak scale-invariance test at its 5,000ms timeout.
The shuffled failures were the persisted-field reader check at its 15,000ms
timeout and the vocabulary check at its 5,000ms timeout. Unchanged standalone
diagnostics passed: soak 37/37, keyread 3/3 and terms 10/10. These passes suggest
load sensitivity but do not erase the failed broad runs. No unrelated code or
timeout limits were changed. The broad runs preceded the final additional
company-site guards.

## Security and deployment boundaries

Company-site HawkScan DAST is blocked locally because the scanner runtime and
key are absent. The existing hosted workflow builds and scans the application,
not the company site. No company-site security-green claim is supported.

Before these changes, Vercel project `semester-company-site` served production
commit `80fc459cf22c8fc2583ee02319012d5e13b5df7d` on `semester.website` and
`www.semester.website`; the apex redirected to `www`. Deployment and public
source checks confirmed that pre-change target. The new brand and interaction
changes remain local and require their own reviewed release and live checks.
