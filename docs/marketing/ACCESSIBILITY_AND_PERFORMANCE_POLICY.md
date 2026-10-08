# Accessibility and performance policy — public site

Status: proposed. Checklist: [`WCAG_22_RELEASE_CHECKLIST.md`](WCAG_22_RELEASE_CHECKLIST.md).

## 1. Accessibility claims

Build toward WCAG 2.2 AA. **Do not state** "WCAG compliant", "WCAG 2.2 AA compliant",
"fully accessible", "ADA compliant", "accessible to all", or a VPAT/ACR, until a scoped,
qualified assessment supports the exact claim (CLM-007/008; `docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md`
says no ACR has been issued). Higher-ed buyers ask for the standard and conformance posture
through HECVAT-style review, so the honest statement matters commercially as well as legally.

Wording that is consistent with the register today (counsel to confirm):

> Semester is working toward an accessible experience. We use automated accessibility
> checks on [named routes] and a manual test plan, and we have not yet completed a formal
> assessment or published a conformance report. If you meet a barrier, tell us at
> [accessibility contact]; we respond within [route SLA, 48 h].

A known-issues list with the ledger link and a date is allowed and encouraged. The statement
page publishes only when `ACCESSIBILITY-STATEMENT-DRAFT.md`'s four publish conditions pass.

## 2. Standing requirements

Every public page meets the checklist rows in structure, keyboard, focus, content, forms,
motion, responsive, tables/dialogs and third parties. Specific commitments:

- Server-rendered `h1`, landmarks and `lang`, readable with JS off.
- No inline third-party widgets that block the primary CTA or first paint; calendar, chat and
  video load on interaction or after consent, each with a plain link fallback.
- All motion via tokens so `prefers-reduced-motion` and the app's "still/calm" setting apply.
- No carousel that advances on its own; no autoplay audio; captions and transcript for every
  video (the existing YouTube embed needs both and no autoplay).
- A single form-error pattern (field message + error summary) shared by every form.
- Light, dark, high-contrast and forced-colors all reviewed.

## 3. Performance budgets

Respect `app/perf-budgets.json` (gzip: first load 490,496 B; route 49,152 B) for anything
built in the app/site stack, checked by `npm run budgets`. Add a **marketing route budget**
for `app/src/site` pages: HTML + CSS + JS per page, with prerendered pages shipping no JS
except pages that need it (forms, tools). company-site has no budget today; its 3,238-line
document plus 1,585-line script is the reason to converge.

Targets to measure (not yet measured, so not claimed): mobile first-content and
interactive time on a throttled profile, cumulative layout shift, image weight.
Rules: responsive images with intrinsic `width`/`height`; lazy-load below the fold; no
layout shift from late fonts (fonts are self-hosted: preload the two used faces); defer
non-essential scripts; consent-gate optional scripts; never block the primary CTA.

## 4. Monitoring

Add frontend error monitoring and route-performance measurement. Both are subject to the
analytics preconditions: first-party, consent-aware, no PII, no session replay, no third-party
SDK that sets cookies. Until the decision, use the existing local-only `timing.ts` approach in
development and the existing `smoke:performance` and `smoke:public-production` scripts in CI.

## 5. Release gate

A page publishes only when: checklist complete with dated records; no unresolved critical
accessibility issue; every claim rendered resolves to an eligible content/claim record; every
testimonial and logo approved; primary CTA and lead intake verified end to end; consent copy
and privacy link verified; analytics respects consent and carries no sensitive data;
broken-link scan passes; title, description, canonical present; owner and review date assigned.

## 6. Known contrast rule (from CLAUDE.md)

Contrast is measured against every surface a token can land on. The faint rung may not carry
information text. Any new marketing surface token is added to the `lib/contrast.test.ts` walk
in the same change.
