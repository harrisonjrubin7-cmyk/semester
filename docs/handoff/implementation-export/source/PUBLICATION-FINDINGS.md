# Public prototype findings — source audit, not current live-site findings
1. Pages.jsx PilotForm validates locally then sets sent=true; no delivery call is present in the inspected handler. The success UI says 'Request sent'. Replace with a durable actual delivery receipt or explicit local-preview wording.
2. Site.jsx footer and Pages.jsx About assert a first paid university pilot. No supporting current payment/customer/reference proof was obtained here. Hold claim pending approval.
3. Students/pricing pages assert free availability and participating-school access. Confirm actual product/eligibility/price authority before publication.
4. Several pages make absolute statements about student records never reaching AI providers. Verify precise egress scope, enforcement and independent evidence before using that wording.
5. Prototype contact addresses use semester.example. They are placeholders, not actual monitored channels.
6. Sign-in anchor in Site.jsx is '#'. Connect to canonical identity route; do not create static-page authentication.
7. Legal documents are marked draft; no legal publication approval established.
8. Existing pages mix WCAG 2.1/2.2 and HECVAT Full wording. Qualified policy/standard and workbook-version review required before assurance claims.
9. Home sample 'Due Thu 9 Oct' with 2026 context requires date consistency. Avoid real-looking demo dates without accurate calendars and explicit synthetic label.
