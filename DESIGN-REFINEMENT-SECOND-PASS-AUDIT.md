# Semester design refinement: second-pass audit

Date: 2 October 2026
Reviewed commit: `1cbacf01` (`codex/design-refinement-20261002`)

## Verdict

**Request changes before presenting this as a completed shared design-system
unification.** The change is directionally sound, preserves the existing
product, and passes its focused functional, accessibility, contrast, and
responsive checks. Four gaps remain between the implementation and its stated
claims. None is a security or data-loss issue; two are visible inconsistencies,
one is an unintended layout-value change, and one is a design-system adoption
and test-quality gap.

## Required findings

### 1. The shared semantic vocabulary is declared but largely not adopted

The new tokens exist on both surfaces, but the repository has no consumers of
`--brand-canvas`, `--brand-surface`, `--brand-ink`, `--brand-muted`, or
`--brand-focus`. Only `--brand-accent` is consumed once. Every new typography
role has zero consumers, as do the new data-series, control-height, and direct
state roles. The new surface aliases are also unused except for one alias-to-
alias reference inside the token file.

The cross-surface test checks only `string.includes(name)`. It would pass if a
token appeared in a comment, had the wrong value, or was never used. That does
not support the changelog claim that drift is prevented, and it makes the new
layer a dictionary rather than an adopted system.

**Remedy:** either narrow the release claim to “introduced a migration
vocabulary,” or migrate a small canonical slice on both surfaces—canvas,
default text, muted text, focus, primary action, page/section/body typography,
and standard control height—and test both mapping and consumption. Parse
declarations rather than searching raw strings.

Evidence: `app/src/styles/tokens.css:64`,
`app/src/lib/companysitebrand.test.ts:27`,
`DESIGN-REFINEMENT-CHANGELOG.md:9`.

### 2. The revised hero promise and social-share title disagree

The visible H1 says “Turn your semester into one clear next step,” while the
Open Graph title still says “Make your next academic decision with confidence.”
Shared links can therefore present the retired promise even though the page and
conversion test present the new one.

**Remedy:** update `og:title` to the refined promise and extend the conversion
test to cover the document head as well as the sliced home-page body.

Evidence: `company-site/index.html:13`, `company-site/index.html:1046`,
`app/src/lib/companysiteconversion.test.ts:9`.

### 3. The last proof step draws a divider into an empty tablet-grid cell

At the two-column breakpoint, the seventh and final proof step matches
`:nth-child(odd)` after the base `:last-child` rule. Because the breakpoint rule
comes later with equal specificity, step seven regains a right border. Browser
measurement at the 768px check confirmed a solid right border on step seven,
while the missing eighth cell remains empty. This contradicts the changelog’s
“no stray proof borders” observation.

**Remedy:** override the final item after the odd/even rules at the two-column
breakpoint, or express the divider using column-aware selectors that explicitly
exclude `:last-child`. Add a breakpoint assertion for the seven-item case.

Evidence: `company-site/index.html:795`, `company-site/index.html:829`,
`DESIGN-REFINEMENT-CHANGELOG.md:113`.

### 4. The reading measure changed despite the migration-safe claim

`.page-purpose` changed from a literal `68ch` to `--layout-reading`, whose
fallback is `66ch`. No `--reading-width` declaration exists in the application,
so the rendered default becomes 66ch. The difference is small and may be a good
design choice, but it is not value-preserving.

**Remedy:** either use a 68ch fallback during this migration or document the
intentional two-character tightening and validate representative long purpose
copy at phone, tablet, and desktop widths.

Evidence: `app/src/styles/app.css:41`, `app/src/styles/tokens.css:218`,
`DESIGN-REFINEMENT-CHANGELOG.md:15`.

## Advisory findings

- **Structural debt:** `company-site/index.html` remains 5,674 lines and
  `app/src/styles/app.css` remains 11,131 lines. The final cascade successfully
  overrides older gradients and chrome, but source-level reasoning still
  depends on knowing which generation wins. The staged extraction already
  proposed in the primary audit remains the correct remedy.
- **Evidence wording:** “explicit and test-held” is too strong while the test
  verifies names only. “Declared and guarded for presence” is accurate until
  mapping/consumption assertions exist.
- **Formatting:** `git diff HEAD^..HEAD --check` reports trailing whitespace on
  the date line in the primary audit. This is a minor documentation nit, not a
  product defect.

## Checks that passed in this sweep

- App axe-core suite: 24 tests passed. jsdom emitted its existing canvas
  limitation notices; the suite exited successfully.
- Contrast and reduced-motion suites: 42 tests passed across two files.
- Company-site console: no warnings or errors during the inspected home route.
- Viewport geometry: 375px, 1728px, and 844×390 short landscape produced no
  document-level horizontal overflow. These supplement the first pass’s 320,
  390, 768, 1024, 1280, and 1440px checks.
- The 768px proof measurement isolated the divider defect without revealing
  content clipping or grid overflow.
- No new dependency, data flow, authentication path, executable script, or
  external request was introduced by commit `1cbacf01`.

## Review conclusion

The implementation still improves the product and should remain the basis for
the refinement. It is not ready to merge under the stronger “completed shared
system” claim until the four required findings are resolved or the claims are
narrowed to match what was actually shipped.
