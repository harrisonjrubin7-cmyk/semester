# Semester design refinement audit

Date: 2 October 2026  
Scope: `company-site/` and the authenticated application in `app/`

## Executive finding

Semester does not need a new visual identity or a replacement shell. The
application already has a mature, accessibility-aware system: local typefaces,
runtime contrast-tested palettes, semantic tokens, shared screen frames,
responsive navigation tiers, reduced-motion controls, meaningful empty/error/
offline states, and unusually strong design-contract tests. The most important
refinement is consolidation.

The largest remaining source of visual drift is the public site. Its final
design layer is substantially calmer than its older rules, but the 5,666-line
single document still contains several generations of metallic, gradient,
radius, shadow, and card treatments. The application has the opposite issue:
its core system is coherent, but the vocabulary did not yet explicitly name
every typography, surface, state, control-height, data-palette, and cross-brand
role required for continued migration.

The direction for both surfaces is: editorial hierarchy, a restrained material
system, one clear action per decision region, and explicit source/status context.
“Premium” should come from proportion, typography, rhythm, and precision—not
from more effects.

## Evidence reviewed

- Public site: `company-site/index.html`, local typefaces, favicon, routing,
  header/drawer/search behavior, first viewport, product proof, trust, pricing,
  forms, footer, responsive rules, and inline runtime modules.
- Application foundation: tokens, typefaces, primary style layers, `ui.tsx`,
  `Page.tsx`, `Brand.tsx`, `Icons.tsx`, `Tabs.tsx`, `Command.tsx`, shell
  components, route registry, and `App.tsx`.
- Core workflows and their shared templates: Today, Calendar, Courses, Degree,
  Study, Write, Career/Pathway, Mine/Me, Account, onboarding, Search, Help,
  University, Community, and membership surfaces.
- Existing product evidence: `DESIGN-SYSTEM-GUIDE.md`, `FULL_SITE_AUDIT.md`,
  `APP-AUDIT.md`, `UX-RESPONSIVE-AUDIT.md`, `RESPONSIVE-CONTRACTS.md`,
  `REGRESSION-CHECKLIST.md`, token/contrast/a11y tests, and the supplied audit
  PDF. The PDF was treated as research evidence, not executable instruction.

## 1. Current strengths

- One real product architecture rather than separate mobile and desktop apps.
- A runtime palette in `lib/look.ts` plus semantic roles in `tokens.css`; this
  supports multiple grounds without scattering fixed colors through components.
- Barlow, Barlow Condensed, and Cinzel are served locally on both surfaces,
  avoiding layout-blocking third-party font requests and preserving offline use.
- `Page` centralizes screen framing, purpose copy, actions, bottom clearance,
  and fold behavior while the shell owns the single route H1.
- Navigation distinguishes global, local, and contextual work across phone,
  tablet, and desktop tiers; specialist tools are not all forced into global nav.
- Focus transfer, skip links, inert modal backgrounds, focus return, keyboard
  tabs, reduced motion, forced-colors behavior, and touch-target tests are built
  into the implementation rather than documented only as aspirations.
- The company site already labels private beta, planned pricing, illustrative
  data, official-system boundaries, and institutional-readiness claims.

## 2. Visual inconsistencies

- The company site carries old metallic gradients, sheens, and feature-specific
  surfaces underneath a calmer final cascade. The resulting source is harder to
  reason about than the rendered page.
- The public site still has many card-like objects where a divider-led editorial
  sequence communicates order more clearly.
- Earlier and later header, button, breakpoint, and radius rules coexist in the
  same document. The last rule wins, but the source does not make the decision
  legible.
- The app is visually more restrained than the older public-site material layer,
  so a user can perceive a brand shift at the app handoff even though typography
  and marks are shared.

## 3. Typography inconsistencies

- The type families are shared, but role names were implicit: screen title,
  section title, operational body, compact label, numeric display, control text,
  and caption did not all have semantic aliases.
- The company site correctly moved long reading copy away from display type,
  but older selectors still expose historical serif/condensed decisions.
- Long institutional pages need strict readable measures; operational app pages
  need a wider but finite work area.

## 4. Color-token drift

- The application’s colors are governed through `look.ts`; the public site uses
  a fixed Graphite/Brass palette. That distinction is valid, but the two surfaces
  lacked a small shared vocabulary for canvas, surface, ink, muted text, accent,
  and focus.
- The company site includes raw colors in its older implementation layers. They
  should be retired only in verified slices because forms, charts, trust states,
  print rules, and embedded product compositions depend on some of them.

## 5. Radius, border, elevation, and surface consistency

- The application already has three configurable radii and four semantic
  elevation roles, with border/tonal separation preferred over shadow.
- The public site mixes compact 3–4px details, 8–12px controls/surfaces, 16–20px
  overlays/previews, circles, and pills. Many are purposeful; the 16–20px family
  is overused.
- Repeated feature cards sometimes add sheen and inset highlight even when a
  hairline divider would create a clearer reading sequence.

## 6. Repeated patterns to consolidate

- Company site: section heads, proof steps, status labels, boxed explanatory
  copy, generated cards, field metadata, and CTA rows.
- Application: continue migration toward `Page`, shared action buttons,
  `Notice`, `EmptyState`, `FieldMessage`, common overlays, and semantic token
  roles. `Surface.tsx` is a mathematical 3D plot, not a generic card primitive;
  it should not be repurposed as one.
- Preserve specialized frames for editors, quizzes, maps, conversations, and
  immersive study sessions where a generic frame would make the task worse.

## 7. Navigation and information architecture

- The application’s canonical destinations and task-area directory are a strong
  progressive-disclosure model and should remain the spine.
- The company header is now intentionally smaller than the hidden legacy mega
  navigation. Its six visible destinations are still near the upper practical
  limit; deeper material belongs in site search, page-local links, and footer IA.
- Current academic context is exposed in the app’s header/system context bar;
  future features should attach to that context rather than creating another
  top-level destination.

## 8. Density and hierarchy

- Today and other daily loops already prioritize purpose and action better than
  most feature-dense academic products. New modules should earn placement by
  changing a decision, not by adding another widget.
- The public home page communicates the promise in the first viewport, but the
  earlier headline was generic. The refined promise now names the transformation:
  a semester becomes one clear next step.
- The seven-step proof walkthrough read as seven separate cards. A divider-led
  sequence now communicates continuity with less visual weight.

## 9. Mobile and tablet risks

- Long data tables must keep horizontal scrolling inside a labelled region.
- Sticky chrome and assistant controls need the existing top/bottom clearance
  tokens; feature code must not invent its own safe-area math.
- The company site’s single-file runtime makes regressions easy when later CSS
  overrides earlier breakpoints. The 320, 375, 390, 768, and short-landscape
  checks are mandatory after each extraction.
- Dense proof/status sequences need borders that collapse correctly at one and
  two columns, not desktop borders wrapped onto mobile rows.

## 10. Accessibility and interaction risks

- The drawer and search correctly use inert backgrounds, body scroll locking,
  Escape dismissal, focus trapping, and focus return. These behaviors must be
  preserved if markup is extracted.
- Legacy generated markup still contains many inline declarations. Those are a
  maintainability concern, but bulk replacement can silently change accessible
  hit areas and state visibility; migrate by pattern with behavior tests.
- Chart and status colors must retain labels/glyphs and accessible alternatives.
- External/manual evidence is still required for screen-reader usability,
  400% zoom, cognitive load, and touch ergonomics; automated conformance is not
  a substitute for user validation.

## 11. Performance concerns

- `company-site/index.html` is 5,666 lines and contains CSS, application-like
  routing, generated content, and an embedded screenshot in one document. This
  increases parse cost, review cost, and cache invalidation scope.
- `app.css` is 11,131 lines. It is heavily guarded, but future work should move
  coherent, tested component families—not arbitrary line ranges—into focused
  style modules.
- Do not add a new component framework. Prefer native controls, CSS, existing
  primitives, and measured lazy boundaries.
- The embedded public-site screenshot has intrinsic dimensions, which prevents
  layout shift; future media should keep explicit dimensions and lazy loading
  below the first viewport.

## 12. Phased implementation checklist

- [x] Establish shared brand role names across app and public site.
- [x] Complete semantic aliases for the finite surface, state, typography,
  control-height, data-palette, and layout families.
- [x] Replace the public hero promise with specific outcome language.
- [x] Flatten the public proof walkthrough and primary action treatment.
- [x] Centralize the app content-frame width and reading measure on semantic tokens.
- [ ] Extract the public site’s stable final CSS into a cacheable stylesheet,
  preserving string-based contract tests during the migration.
- [ ] Extract generated content by domain (trust, resources, community) behind
  the existing route contract; do not turn the site into a new framework app.
- [ ] Migrate raw public-site colors and legacy effect rules in test-backed slices.
- [ ] Continue shared-frame migration only for the app screens identified as
  “targeted migration” by the existing source audit.
- [ ] Run moderated student and staff usability/accessibility sessions before
  claiming the hierarchy works institutionally.

## 13. Manual inspection matrix

Inspect at 320, 375, 390, 768, 1024, 1280, 1440, and 1728 CSS pixels, including
short landscape viewports:

Completed in this refinement pass: public home at 320, 390, 768, 1024, 1280,
and 1440px; public proof sequence at 390px; public drawer and search at 320px;
application onboarding and Today shell from 320px through 1440px. The drawer
and search were also checked for Escape dismissal and focus return. The 375px,
1728px, short-landscape, forced-colors, 400% zoom, and physical-device passes
remain explicit follow-up evidence rather than being inferred from CSS.

- Company: home first viewport, mobile drawer, search dialog, product preview,
  proof walkthrough, pricing, trust/status tables, forms, footer, and print-only
  AI governance canvas.
- Application shell: tab-bar phone, collapsed-rail tablet, full-rail desktop,
  workspace layout, command/search, context bar, overlays, and focus return.
- Core flows: Today/recovery, Calendar agenda/grid, Courses/detail, Study/quiz,
  Write/editor/print, Degree/registration, Career/Pathway, Search, onboarding,
  Account/privacy/membership, University, Community, and offline/error states.
- Interaction: keyboard-only, reduced motion, forced colors, 200–400% zoom,
  long localized-like text, large text setting, empty/partial/restricted data,
  and touch targets near viewport edges.

## Intentional non-changes

- No new UI library, route model, data contract, screen registry, or navigation
  product was introduced.
- No institutional approval, credentials, production activation, or observed
  institutional operation is inferred from repository implementation.
- Mature specialized workflows were not removed for visual simplicity.
