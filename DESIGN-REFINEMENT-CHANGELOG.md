# Semester design refinement changelog

Date: 2 October 2026

## Material changes

### Shared foundation

- Added one semantic brand vocabulary—canvas, surface, ink, muted text, accent,
  and focus—to both the public site and application. Each surface retains the
  material appropriate to its job while sharing the same conceptual roles.
- Completed the application’s semantic token families for plain/quiet/feature/
  modal/critical surfaces, disabled/read-only/locked/preview/destructive states,
  typography roles, control heights, data-series colors, and operational width.
- Replaced the app page frame’s fixed `1180px` and purpose copy’s fixed `68ch`
  with `--layout-operational` and `--layout-reading`. This is migration-safe:
  rendered values remain unchanged.
- Extended token and company-brand tests so the shared vocabulary cannot drift
  silently.

### Company site

- Rewrote the home-page promise from a generic confidence claim to the specific
  outcome: “Turn your semester into one clear next step.” Supporting copy and
  truthful private-beta/product boundaries remain intact.
- Replaced the gradient/chrome primary-action treatment with the established
  solid Brass action color and removed its decorative inset shadow.
- Removed backdrop blur from the sticky header. The header keeps an opaque,
  high-contrast Graphite surface and hairline separation.
- Changed the seven-step product proof from separate rounded cards into one
  divider-led editorial sequence. Desktop, two-column, and single-column border
  rules are explicit so the sequence does not create stray mobile edges.
- Reduced overlay radii to the shared surface radius while preserving focus,
  Escape, inert-background, scroll-lock, and focus-return behavior.

## Accessibility and responsive consequences

- Focus colors, target sizes, semantic headings, dialog behavior, reduced
  motion, and forced-colors rules are unchanged.
- The new public headline is shorter and wraps more predictably at 320–390px.
- Proof steps retain source order and full text at every width; only the visual
  grouping changed.
- Primary actions no longer depend on a gradient to appear actionable; text and
  border contrast remain explicit.

## Tradeoffs and intentional non-changes

- The public site remains a large single document in this pass. Extracting CSS
  and domain modules is valuable, but doing it together with visual changes
  would make regressions harder to attribute and would break existing
  string-level contracts without a staged test migration.
- Application screens were not restyled independently. The existing shell,
  `Page`, actions, states, and responsive tiers already propagate the intended
  hierarchy; adding feature-local decoration would increase drift.
- The app’s configurable ground/accent system remains dynamic. “Shared brand”
  means shared structure, typography, semantics, mark, and interaction quality—
  not forcing every accessibility preference into one fixed palette.
- Planned pricing, private-beta status, illustrative data, and institutional
  readiness boundaries remain visible and unchanged.

## Final review answers

- **Does the company site feel like the same brand as the logged-in app?** Yes
  at the level of mark, type, semantic roles, restrained surfaces, and action
  hierarchy. The public site remains intentionally more editorial.
- **Can a new user understand the product in the first viewport?** Yes: the
  headline names the transformation, the supporting line names the inputs, and
  the real product image plus primary/secondary actions show what to do next.
- **Can a returning student identify the most important next action quickly?**
  The existing Today hierarchy is designed for that; this pass does not claim
  new moderated timing evidence.
- **Is each screen driven by a primary decision?** Core routes are. The broad
  secondary surface still contains targeted-migration candidates documented in
  the source audit.
- **Are cards intentional rather than default containers?** More so: the public
  proof sequence no longer uses cards. Some legacy site modules remain future
  consolidation work.
- **Are typography, colors, radii, borders, icons, and shadows consistent?** The
  semantic contract is now explicit and test-held. Historical public-site CSS
  still needs staged extraction/removal.
- **Does mobile feel designed rather than squeezed?** Existing app tier contracts
  and public single/two-column rules say yes in implementation. The rebuilt
  company site was visually inspected at 320px, 390px, 768px, 1024px, 1280px,
  and 1440px, including the flattened proof sequence. The rebuilt application
  was checked at 320px, 390px, 768px, 1024px, 1280px, and 1440px across both
  onboarding and the real Today shell. Broader physical-device and student
  validation remain required.
- **Is the interface calmer while remaining powerful?** Yes: effects and boxes
  were removed without removing content, routes, states, or workflows.
- **Are unhappy paths as polished as happy paths?** The app has shared offline,
  error, empty, partial, permission, and recovery patterns. The full site-wide
  manual state matrix remains an ongoing QA obligation.
- **Are interactions accessible and keyboard usable?** Existing automated and
  implementation evidence is strong; no interaction behavior changed here.
  Manual assistive-technology evidence is still required before a conformance
  claim.
- **Is the result more coherent without becoming generic?** Yes: Semester keeps
  its Graphite/Brass/Silver materials, Barlow/Cinzel typography, provenance
  language, and academic decision hierarchy.
- **Were existing strengths preserved?** Yes. No route, data contract, workflow,
  accessibility preference, or institutional boundary was removed.

## Validation record

### Passed

- TypeScript project build: passed.
- Production application build: passed (3,417 modules transformed). The build
  retains the repository's existing large-chunk warning.
- Company-site build: generated 54 files in `dist-site/`. Its optional local
  WebSocket listener was denied by the sandbox; static generation completed.
- Changed-area Vitest run: 7 files and 51 tests passed, covering semantic
  tokens, cross-surface brand roles, conversion copy, navigation/dialog
  behavior, motion, and gutters.
- Repository style, accessible-label, and terminology policies: passed.
- Oxlint: within the configured 25-warning budget with 22 existing React
  compiler warnings; none point to a changed file.
- `git diff --check`: passed.
- Visual inspection: public home at 320px, 390px, 768px, 1024px, 1280px, and
  1440px; proof sequence at 390px; application onboarding and Today shell from
  320px through 1440px. The shell consumed the full phone viewport without
  document-level horizontal overflow; its quick-action rail intentionally
  remains horizontally scrollable. No clipping, overlap, stray proof borders,
  or broken first-viewport hierarchy was observed.
- Interaction inspection: the 320px company drawer and search dialog opened as
  labelled dialogs, accepted Escape, closed, and returned focus to the Menu and
  Search launch controls respectively.

### Broader-suite and security limits

- The full Vitest run exited with 43 failures. One was the intentionally stale
  hero-copy contract; it was updated and passed in the 51-test rerun. The other
  failures were in untouched suites and were dominated by existing 5–15 second
  timeouts, async render cascades, missing canvas support, and jsdom navigation
  limitations. This refinement does not claim a green repository-wide suite.
- HawkScan preflight was attempted as required. Neither the `hawk` runtime nor
  Docker is installed, and `HAWK_API_KEY` is unavailable, so no DAST scan could
  start. No scan result or security-clearance claim is made.
