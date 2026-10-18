> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester open-source license compliance policy — draft

- **Policy owner/backup:** `[ENGINEERING + LEGAL OWNERS]`
- **Covered repositories/products/entities:** `[TBD]`
- **Approved license policy version:** `[TBD]`
- **Review cadence:** `[EACH CHANGE/RELEASE PLUS PERIODIC COUNSEL REVIEW]`

## Plain-language summary

Semester inventories and tests many software dependencies, license identifiers, registry origins, integrity hashes, workflow publishers and release SBOM generation. Those controls are useful technical evidence, but they are not a legal opinion, a complete source/content inventory, signed provenance, or proof that all attribution and distribution obligations are satisfied.

## Required lifecycle

1. Request the component with purpose, repository, runtime/build/test use, distributed form, modifications, data access, maintainer/provenance and alternatives.
2. Identify the actual license text and version from authoritative package/source materials; do not rely only on an automated identifier.
3. Route unknown, missing, dual, source-available, copyleft, network-copyleft, noncommercial, field-of-use, trademark/patent or custom terms to counsel before use.
4. Approve, condition, isolate, replace or reject; record reviewer, reasoning, scope, version and re-review trigger.
5. Lock and test approved versions; preserve source/offer, attribution, copyright, license text, modification notices and relinking/source obligations where applicable.
6. Generate release-specific inventory/SBOM and notices; compare the shipped artifact, not merely the manifest; block unresolved shipped obligations.
7. Monitor advisories, license/provenance changes, forks, end-of-life and supplier compromise; remediate, replace, disable or roll back.

| Review field | Required value |
| --- | --- |
| component/version/hash/source | `[TBD]` |
| use and distribution path | `[RUNTIME / BUILD / TEST / SERVICE / CONTENT]` |
| license text/SPDX and obligations | `[TBD]` |
| modifications/linking/network use | `[TBD]` |
| notices/source offer/patent/trademark | `[TBD]` |
| approver/date/conditions/expiry | `[TBD]` |

## Product-behavior and evidence mapping

| Control | Current evidence | Limitation |
| --- | --- | --- |
| dependency/license admission | [`docs/SUPPLY-CHAIN.md`](../SUPPLY-CHAIN.md) and supply-chain tests | policy choices need counsel approval; identifiers may be incomplete |
| registry/integrity/workflow control | lockfiles and CI tests | no signed build provenance or supplier-compromise playbook |
| SBOM | deploy workflow produces CycloneDX and retains it for 90 days | not signed/published and must be matched to the released artifact |
| notices | this companion template | no verified generated notice bundle or counsel-approved distribution process yet |

The current Remotion/source-available decision in the supply-chain register remains open for its stated company-size/use conditions and must not be described as ordinary open-source approval.

## Release and publication blockers

Complete shipped-component inventory; counsel-approved license policy; resolved unknown/custom/copyleft/source-available terms; exact notices and source/offer obligations; modification review; artifact-to-SBOM comparison; fonts/media/content/API/model terms; export/patent/trademark issues; owner and exception expiry; and retained release evidence. Jurisdiction, distribution channel, user age and institutional/customer license terms must be reviewed where they change the analysis.
