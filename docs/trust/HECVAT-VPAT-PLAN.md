# HECVAT and VPAT/ACR: 90-Day Plan

HECVAT is a higher-ed vendor assessment questionnaire, and a VPAT is the
template used to write an Accessibility Conformance Report (ACR). **Neither is
a certification.** Both must be completed honestly, against the version of
Semester actually deployed. The control-by-control state is already kept, and
kept true by test, in `docs/market-readiness/HECVAT_READINESS.md`. This page
is the plan that moves those rows.

## HECVAT workstreams

| Area | Evidence needed | Owner role | Register rows |
| --- | --- | --- | --- |
| Organization | Legal entity, policies, security contacts, insurance | CEO / operations | GOV-1, LEGAL-2 |
| Governance | Security program, risk register, policy review, vendor management | Security and privacy | GOV-2 |
| Application security | Secure SDLC, review, dependency and secret scanning, tests | Engineering | SDLC-1, SDLC-2 |
| Infrastructure | Hosting architecture, encryption, backups, DR | Platform | CRYPTO-1, BCP-1 |
| Identity and access | SSO, MFA, least privilege, access review, offboarding | Security and identity | IAM-1 to IAM-3 |
| Data privacy | Inventory, DPA, retention, deletion, subprocessors | Privacy and legal | PRIV-1 to PRIV-6 |
| Incident response | IR plan, severity model, notification, tabletop | Security and operations | IR-1 |
| Accessibility | ACR, testing, issue tracking, remediation | Accessibility | A11Y-1 to A11Y-4 |
| AI | Provider list, data use, retention, policy controls, evaluation | AI governance | AI-1 to AI-3 |
| Operations | SLA, support, uptime, monitoring, change management | Customer operations | MON-1, SUP-1 |
| Offboarding | Export, deletion certificate, retention | Customer success and legal | PRIV-2 |

## 90 days

| Days | Work |
| --- | --- |
| 1 to 15 | Inventory systems, vendors, data, policies, environments, access and evidence gaps. Mostly done: the register and [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md) |
| 16 to 30 | Write the missing policies: privacy, acceptable use, vulnerability disclosure, accessibility statement. Assign an owner to each register row |
| 31 to 45 | Implement missing controls: MFA, legacy RLS re-keying, alert wiring, journal backup, restore drill, incident tabletop |
| 46 to 60 | Compile evidence into `docs/evidence/`: architecture and data flow, restore timings, tabletop record, console MFA screenshots, access-review export |
| 61 to 75 | Complete the current HECVAT workbook from the register; internal security, privacy and legal review |
| 76 to 90 | Remediate the critical gaps found; open a controlled procurement room; set a quarterly evidence-review cadence |

## VPAT/ACR workstream

Target: **WCAG 2.2 AA**, plus the applicable Section 508 and ADA requirements.

- [x] Automated journey audits at desktop and 320px reflow, in CI
      (`app/scripts/accessibility-smoke.mjs`)
- [x] Form labels, landmarks, focus, dialogs, motion and contrast, tested
      (`app/src/a11y`, `app/src/lib/contrast.test.ts`)
- [ ] Inventory every journey: student, faculty, advisor, admin, public site
- [ ] Manual keyboard pass on each journey
- [ ] Screen-reader pass with NVDA and VoiceOver (HECVAT A11Y-3); the script and results form are
      [`docs/accessibility/AT-PASS-PROTOCOL.md`](../accessibility/AT-PASS-PROTOCOL.md)
- [ ] Focus-not-obscured, target size and non-text contrast checked by hand
- [ ] Reflow at 320 CSS px and 200% zoom confirmed by a person, not only the probe
- [ ] Captions and transcripts on media, and media controls
- [ ] Forms, errors, dialogs, drawers, tables, charts, maps, files and assessment flows
- [ ] AI-generated content and authoring workflows
- [ ] Record each issue's severity, workaround, owner and target date
- [ ] Publish the ACR with its version, date and known limitations (HECVAT A11Y-2)
- [ ] Publish an accessibility contact and a severity-to-fix-time table (HECVAT A11Y-4)
- [ ] Annual independent audit; accessibility kept as a release gate

The two ticked items are why accessibility is the strongest area in
`docs/market-readiness/ACCESSIBILITY_READINESS.md`. The unticked ones are why
there is still no ACR. An ACR needs a human evaluation, and writing one from
the automated results alone would be fabricating it.
