> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester cookie and browser-storage notice — controlled draft index

> **DRAFT FOR QUALIFIED LEGAL AND PRIVACY REVIEW. This notice is not legal advice, is not in force, and must be reverified against the deployed sites before publication.**

| Control | Draft value |
| --- | --- |
| Version | 0.1 |
| Effective date | `[TO BE APPROVED]` |
| Owner | Privacy owner with Engineering |
| Review frequency | Before publication/deployment and on any storage, analytics, advertising, consent or third-party-script change |
| Canonical substantive draft | [`docs/legal/COOKIE-AND-STORAGE-NOTICE-DRAFT.md`](../legal/COOKIE-AND-STORAGE-NOTICE-DRAFT.md) |

## Current repository position

The canonical draft states that Semester uses browser local/session storage, IndexedDB and offline caches but no cookies, third-party analytics, advertising identifiers or tracking pixels. That statement must be verified against the actual deployed application, company site, headers, tags, providers and network activity before publication.

## Plain-language summary

Semester stores product work, settings, sessions, backups, drafts and offline files in browser storage so the product functions. Clearing site data removes local copies. Signed-in/cloud data has separate retention and deletion rules in the privacy notice.

## Behavior mapping

Maintain a release-bound inventory of each storage key/DB/cache, purpose, category, necessity, duration/trigger, writer/reader, data sensitivity, sync behavior and deletion method. Reconcile company-site attribution/form storage separately from authenticated-product storage.

## Required decisions

- `[LAUNCH JURISDICTIONS AND CONSENT STANDARD]`
- `[CLASSIFICATION OF EACH STORAGE TECHNOLOGY AS STRICTLY NECESSARY OR OPTIONAL]`
- `[APPROVED ANALYTICS/MARKETING POSITION—CURRENTLY NONE EVIDENCED]`
- `[RETENTION, CONTACT AND RIGHTS LANGUAGE]`

## Publication blockers

Confirm intended user ages, minor/guardian or school authority and launch jurisdictions before selecting consent, notice, default, withdrawal or retention rules.

Deployment scan; storage inventory; consent classification; privacy/counsel approval; accessible preference controls if required; withdrawal/deletion testing; and change detection in CI or release review.

## Prohibited claims

Do not say “no cookies” or “no tracking” after adding any applicable technology. Do not display a nonfunctional consent banner or imply optional technology is disabled unless execution is technically blocked before consent.
