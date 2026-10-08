# WCAG 2.2 release checklist — public marketing, sales and Trust Center pages

Status: proposed release gate. **This is a checklist for building toward WCAG 2.2 AA.
Completing it does not support the words "WCAG compliant", "WCAG 2.2 AA compliant",
"fully accessible" or "ADA compliant"** (CLM-008 prohibits them). Those words need a
scoped, evidence-backed, qualified assessment that does not exist today. Approved
public wording is in [`ACCESSIBILITY_AND_PERFORMANCE_POLICY.md`](ACCESSIBILITY_AND_PERFORMANCE_POLICY.md) §1.

How to use it: one copy per page per release. Every row is pass / fail / not
applicable with a reference. A page does not publish with an unresolved critical
accessibility issue, an unsupported claim, a broken primary CTA, broken lead
intake or an unapproved testimonial.

Existing evidence the repository already produces, to attach rather than redo:
`a11y/axe.test.tsx`, `npm run smoke:a11y`, `contrast-sweep`, `targets-sweep`,
`docs/accessibility/AT-PASS-PROTOCOL.md`, `docs/accessibility/first-pass/MANUAL-PASS-KIT.md`,
`docs/accessibility/first-pass/accessibility-issue-ledger.csv`.

## A. Structure

| # | Requirement | Test | Auto? |
| --- | --- | --- | --- |
| A1 | Exactly one `h1`, visible in the rendered HTML (not injected or toggled by JS) | DOM query on rendered output | yes |
| A2 | Heading levels do not skip for visual styling | heading-outline test | yes |
| A3 | `header`, `nav` (labelled), `main`, `aside` where used, `footer` | landmark test (extends `a11y/landmarks.test.ts`) | yes |
| A4 | Skip link is first focusable, targets `main`, visible on focus | `a11y/skiplink.test.tsx` pattern | yes |
| A5 | `lang` set; changes of language marked | HTML check | yes |
| A6 | Unique, descriptive `<title>` (2.4.2) | title uniqueness test | yes |
| A7 | Page works with JS disabled to the extent of readable content (`noscript` fallback or prerender) | render with JS off | yes (prerender) |

## B. Keyboard and focus

| # | Requirement | WCAG | Test |
| --- | --- | --- | --- |
| B1 | Every action works by keyboard: menus, dropdowns, tabs, accordions, dialogs, pricing toggle, comparison table, calendar handoff, forms | 2.1.1 | manual pass + component tests |
| B2 | No keyboard trap; dialogs trap *inside* and release on close | 2.1.2 | `useModal` tests |
| B3 | Esc closes noncritical dialogs; focus returns to the trigger | 2.1.1 / 3.2.x | component test |
| B4 | Visible `:focus-visible` indicator on every control, never removed without replacement | 2.4.7, **2.4.13** (AAA, aim) | CSS guard + manual |
| B5 | Focus is not hidden by sticky header, cookie/consent banner, modal or animation | **2.4.11** Focus Not Obscured (Minimum) | scroll-into-view walk at 320 and 1280; the app already reserves `--focus-clear-top`/`--focus-clear-bottom` |
| B6 | Focus order follows reading order | 2.4.3 | manual |
| B7 | Link/button purpose clear from text or context; no bare "Learn more" without a distinct accessible name | 2.4.4, 2.4.9 | link-text lint |
| B8 | Any drag interaction has a single-pointer alternative | **2.5.7** Dragging Movements | n/a unless a drag exists |
| B9 | Targets at least 24×24 CSS px (aim 44) | **2.5.8** Target Size (Minimum) | `sweep:targets` |
| B10 | Help (contact, support, status) in the same relative place on every page | **3.2.6** Consistent Help | shell test |

## C. Content and contrast

| # | Requirement | WCAG | Test |
| --- | --- | --- | --- |
| C1 | Meaningful images have useful alt; decorative images `alt=""`; no text only in images | 1.1.1, 1.4.5 | alt audit |
| C2 | Charts/diagrams/workflow graphics have a text equivalent | 1.1.1 | review |
| C3 | Text contrast ≥ 4.5:1 (3:1 large) on **every surface it can sit on**, not only the flattering one | 1.4.3 | extend `lib/contrast.test.ts`; CLAUDE.md: measure a ground against every surface it has |
| C4 | UI component and focus-indicator contrast ≥ 3:1 | 1.4.11 | contrast sweep |
| C5 | No colour-only meaning: status, selected, required, error carry text or icon | 1.4.1 | manual + review |
| C6 | Text resizes to 200%, spacing overrides, reflow at 320 px, no loss | 1.4.4, 1.4.10, 1.4.12 | viewport tests at 320, 200% zoom |
| C7 | Content on hover/focus is dismissible, hoverable, persistent | 1.4.13 | manual |
| C8 | Video/audio: captions, transcript, no autoplay audio, pause control | 1.2.x, 1.4.2, 2.2.2 | media review |
| C9 | Dark / high-contrast / forced-colors themes keep every item above | 1.4.x | theme matrix |

## D. Forms (the demo / pilot / contact / report forms)

| # | Requirement | WCAG | Test |
| --- | --- | --- | --- |
| D1 | Visible label per control; label and instructions programmatically associated | 1.3.1, 3.3.2, 4.1.2 | `a11y/labels.test.ts` |
| D2 | Required state shown visually and programmatically (`required` / `aria-required`) | 3.3.2 | unit |
| D3 | `aria-invalid` only while the field is wrong; `aria-describedby` links hint **and** error | 3.3.1, 4.1.2 | extends `a11y/fielderror.test.ts` |
| D4 | Field-level error plus a **form-level error summary** that receives focus after a failed submit and links to each field | 3.3.1, 3.3.3 | new component test (no summary component exists today) |
| D5 | Valid input is preserved on failure; form is never cleared unless reset | 3.3.7 (Redundant Entry) | unit |
| D6 | Autocomplete tokens on name/email/organization | 1.3.5 | unit |
| D7 | Submitting state: `aria-busy`, disabled submit with label, values kept | 4.1.3 | unit |
| D8 | Server error: form-level message, retry, and a support path | 3.3.1 | unit |
| D9 | Success: confirmation, expected response window, clear next step, announced (`role=status` or managed focus) | 4.1.3 | unit |
| D10 | No cognitive-test barrier at sign-in or form submit | **3.3.8** Accessible Authentication | review |
| D11 | Marketing consent is separate, unchecked, optional, and not required to submit | (FTC/CAN-SPAM, not WCAG) | unit |
| D12 | No forced short timeout; warn and allow extension where a session expires | 2.2.1 | review |

## E. Motion and responsive

| # | Requirement | Test |
| --- | --- | --- |
| E1 | `prefers-reduced-motion` disables non-essential motion, parallax, looping animation, auto-scroll | `a11y/motion.test.ts` extension |
| E2 | No auto-advancing carousel without pause/stop | review |
| E3 | Essential content never conveyed only by animation | review |
| E4 | 320 px: no horizontal page scroll; tables have a card/stack alternative | viewport test |
| E5 | Mobile landscape and 200% zoom reflow | manual + viewport test |
| E6 | Orientation is not locked | 1.3.4 |

## F. Tables, dialogs, third parties

| # | Requirement | Test |
| --- | --- | --- |
| F1 | Tables: `<caption>`, scoped headers, sortable headers are buttons with `aria-sort`; mobile alternative | table test |
| F2 | Modal: accessible name, focus moves in, trapped, Esc, returns | `useModal` |
| F3 | Accordion/tabs: correct roles, arrow-key behaviour where the pattern requires | component test |
| F4 | Calendar / chat / video / analytics widgets: a fallback link, loaded only after consent, never blocking the primary CTA or first paint | block-the-script test |

## G. Release test protocol

Automated (CI where feasible): axe on every public route at 320 and desktop; heading,
landmark, title, alt, label, link-text and contrast checks; broken-link scan; the
`a11y/*` suite.

Manual (recorded in the issue ledger with date, browser, AT, version, tester):
keyboard-only header-to-footer; screen-reader smoke on home, demo form, pricing,
Trust Center and FAQ; 200% zoom; 320 px; reduced motion; form error and success
states; modal/accordion/tabs/table/mobile menu.

**Evidence rule.** A manual row is `pass` only with a dated record. "Not done" is
a legitimate and honest status: the site already says no manual screen-reader pass
has been recorded. Do not mark a row to make the page publishable.

## H. Page record template

```
Page:            route + commit
Release:         date
Automated:       axe=__  heading=__  landmark=__  contrast=__  links=__
Manual:          keyboard=__  SR=__  zoom=__  320px=__  motion=__  forms=__
Open issues:     ledger ids, severity
Claims:          register ids rendered on this page
Decision:        publish / hold   Approver: __   Date: __
```
