> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester cookie and storage consent implementation specification

> **DRAFT FOR QUALIFIED LEGAL AND PRIVACY REVIEW. This is an engineering specification, not a conclusion about which consent rules apply in any jurisdiction.**

| Control | Draft value |
| --- | --- |
| Version | 0.1 |
| Effective date | `[TO BE APPROVED]` |
| Owner | Privacy owner with Engineering |
| Review frequency | Per release affecting storage/tags; annual full review |
| Approval authority | Privacy/Legal for classification and language; Engineering for verified implementation |
| Current default | No optional cookies, third-party analytics, advertising or tracking technology may execute |

## Objective

Keep optional technology fail-closed until a qualified reviewer determines the applicable rule, the user makes a valid choice, and automated verification proves the choice controls execution—not merely UI text.

## Plain-language summary

The current product is intended to operate without advertising or third-party analytics cookies. If Semester later proposes optional analytics, preference, embedded-content, or marketing storage, it must stay off until any required choice is obtained, be as easy to reject or withdraw as to accept, and be enforced in code and network behavior rather than only described by a banner.

## Categories

| Category | Default | Examples | Consent behavior |
| --- | --- | --- | --- |
| strictly necessary | allowed only when documented | authentication/session, security, requested offline/product storage | explain; no marketing reuse |
| preferences/functionality | off unless necessary or approved | nonessential remembered display/feature preference | follow approved jurisdiction rule |
| analytics | OFF | product/site analytics beyond approved first-party necessary operation | do not load/write/send before valid choice where required |
| advertising/targeting | PROHIBITED unless separately approved | pixels, cross-site IDs, audience building | remain absent from current product |

Browser storage is classified by purpose and behavior, not by whether the API is named “cookie.”

## Consent state

If optional technology is approved, store a versioned record containing policy version, categories, choice, timestamp, jurisdiction basis if used, source surface and withdrawal timestamp. Do not store sensitive profiling in the consent record. A missing, corrupt, expired or superseded record means optional categories are off.

## Execution contract

1. Load only documented necessary code before preference resolution.
2. Resolve current consent version and approved jurisdiction behavior.
3. Render an accessible, equal-choice interface where required; reject must be as usable as accept.
4. Load optional code only after the corresponding affirmative state.
5. Withdrawal immediately prevents future optional collection and initiates applicable local/vendor deletion.
6. Policy/category/vendor changes invalidate affected consent and require renewed choice where required.
7. Server, tag manager, iframe, pixel, SDK and edge paths obey the same state.

## User interface requirements

- Plain-language purposes and named providers/categories.
- No preselected optional choices, misleading color, obstruction or repeated coercion.
- Keyboard/screen-reader/zoom/reduced-motion support.
- “Manage privacy choices” remains available after dismissal.
- Product remains usable when optional technology is refused, except the clearly named optional feature.

## Verification

For each supported browser/device and applicable region scenario, test fresh visit, accept selected, reject all, granular selection, reload, new policy version, withdrawal, cleared/corrupt storage, signed-in/out, blocked third-party request and deletion. Network assertions must prove no optional request or identifier occurs before permission.

## Change gate

Any new cookie, local/session storage purpose, IndexedDB store, service-worker cache, tag, SDK, iframe or remote request requires inventory, classification, notice, data-flow/vendor review and automated test before deployment.

## Current release decision

Because no optional tracking technology is evidenced, do not add a performative consent banner. Publish an accurate storage notice only after deployment verification. If optional technology is proposed, implement and approve this control before that technology ships.

## Product-behavior mapping

| Area | Current evidence | Status / change required |
| --- | --- | --- |
| no intentional cookies/ad trackers | company-site statement, legal source draft, tracking-host tests | repository-evidenced; verify deployed app/site/auth/media/payment surfaces |
| local/IndexedDB storage | persistence and privacy code | necessary/product storage; inventory purposes, keys and retention |
| visit attribution/forms | company-site behavior | verify session scope, submission contents and notice |
| signed-in service analytics | privacy code/database controls | reconcile field list, purpose, retention and jurisdiction/legal basis |
| consent enforcement | no optional technology currently approved | implement this specification before enabling any optional category |

## External decisions

Applicable jurisdictions, legal basis, consent duration, age treatment, global-privacy-control handling, vendor deletion and record retention require counsel/privacy approval.

## Publication and implementation blockers

Deployed storage/network inventory; counsel-approved category and jurisdiction decisions; accessible/dark-pattern review; vendor/data-flow/retention approval; versioned enforcement and withdrawal tests; and alignment among product behavior, Privacy Notice, Cookie Notice, company-site language, and institutional configuration.
