# Accessibility governance beyond compliance

The engineering side already has guards. `npm run lint` runs the label audit. `lib/contrast.test.ts` walks the whole
colour ramp on every ground. `npm run smoke:a11y` exercises the critical accessibility journeys. See
[ACCESSIBILITY_READINESS.md](../market-readiness/ACCESSIBILITY_READINESS.md). What those guards can't provide is a
company discipline, and that's what this document sets up.

| Practice | How | Owner |
| --- | --- | --- |
| Accessibility champions | One each in engineering, product and content; 10% time; monthly sync | Accessibility lead |
| Accessibility backlog with severity and SLA | Critical: 5 business days · Serious: 30 days · Moderate: 90 days · Minor: next major release | Accessibility lead |
| Assistive-tech user panel | Paid panel of screen-reader, switch, voice-control, magnification and cognitive-disability users; monthly sessions | Product research |
| Content-author validation | Tenant content (Tier 1 settings, resources) validated for alt text, headings, link text and contrast before publishing | Content owner |
| Procurement review for every extension | Required for certification (see [CONFIGURATION-TIERS.md](CONFIGURATION-TIERS.md#extension-framework)) | Accessibility lead |
| Accessible event and resource metadata | Events and services carry step-free access, captioning, ASL and quiet-space fields | Content owner |
| Alternate-format request workflow | Student requests an alternate format → accessibility office → fulfilled with SLA; no reason required | Accessibility office (tenant) |
| Accessibility release notes | Every release note has an accessibility section, even if it says "no change" | Product |
| Annual independent audit | External WCAG 2.2 AA audit; ACR/VPAT refreshed | Accessibility lead |
| Metrics | Issues discovered, time to resolve by severity, and recurrence (the same defect class returning) | Accessibility lead |

**Recurrence** is the metric that shows whether the discipline is working. If a defect class keeps coming back, the
fix belongs in a shared component or a lint rule. That is how the label audit and the contrast ramp test came to
exist.

## The seat

**Accessibility lead: [@harrisonjrubin7-cmyk](https://github.com/harrisonjrubin7-cmyk), from 2026-10-04.** Self-named by the repository owner. The three champions (engineering, product, content), the paid assistive-technology panel and a monitored accessibility mailbox are **not** yet in place; the program's roadmap ([`docs/accessibility/PROGRAM.md`](../accessibility/PROGRAM.md) §7) lists them as open items.
