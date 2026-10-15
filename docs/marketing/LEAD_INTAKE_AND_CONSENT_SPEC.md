# Lead intake and consent specification

Status: proposed. Extends the existing `lead-intake` Edge Function and `submit_site_lead`
RPC. The gap list is in [`COMPANY_SITE_CURRENT_STATE.md`](COMPANY_SITE_CURRENT_STATE.md) §4.

## 1. Principle

One public door, server-validated, minimal data, no table exposed to the browser.
Service/contact consent is recorded separately from marketing consent; marketing consent is
never pre-checked and never required.

## 2. Fields

Required: first name, last name, work email, organization, role, primary workflow/use case,
privacy acknowledgment. Optional: institution type, enrollment band, current challenge,
desired pilot timeline, free-form message, **separate** marketing opt-in.

Today's endpoint takes `name` (one string); the form splits first/last and the function
stores the joined form unless a migration adds columns (proposed, additive).

**Never collected:** academic records, grades, accommodations, financial aid, health,
disciplinary information, student identifiers, support-ticket content. The free-text fields
carry a visible warning ("Do not include student information"), and the server rejects
values that look like an SSN or a student-id pattern rather than storing them.

## 3. Server behaviour (existing → required)

| Control | Today | Required |
| --- | --- | --- |
| Validation | route regex, name, email regex, length limits, ≤20 `fields`, 16 KB | keep; add enumerations for role, institution type, enrollment band, timeline (reject unknown values) |
| Sanitisation | length and key-shape limits; stored as text | strip control characters, normalise whitespace, never render stored text as HTML |
| Rate limit | 5/hour per HMAC IP hash, advisory lock | keep; add per-email-hash limit to blunt IP rotation |
| Honeypot | `website` field → decoy 200 | keep; add a minimum-fill-time check |
| Origin | strict allow-list | keep |
| Consent | `consent_updates` stored as a free field | **record** policy/consent version, wording hash, timestamp, source form, and the service-ack and marketing choices as two separate rows |
| Suppression | none | check a **site-scoped** suppression list before any automated marketing send; a suppressed email can still file a service request but never receives marketing |
| Attribution | free-text `page`/`fields` | structured `utm_source/medium/campaign/content`, `landing_path`, `referrer_host` (host only, no query) |
| Routing / owner | `cta_routes` owner_team; account and stakeholder upsert | assign an owner and `respond_by` explicitly; state the SLA in the success message only if it is the route's real SLA |
| Audit | none | one append-only event per submission (no PII beyond the lead id and route) |
| Response | `{ok, reference}`; errors 400/403/405/413/429/500/503 | keep; success is generic and never reveals whether an email already exists or is suppressed |

**Do not reuse `gtm_consent` / `gtm_suppression` for site visitors.** They are keyed to a
school's tenant prospects; the header of `20260929080000_commercial_automation.sql`
records why: filing a visitor there would put a stranger in a school's audience. New
site-scoped tables: `site_consent` (append-only) and `site_suppression`, both RLS-on, no
grants, service-role only, registered per `tablerls.test.ts` and `DEFINER-RLS-REGISTER`.

## 4. States (public result states)

Idle · Focused · Valid · Invalid · Submitting · Server error · Success · Disabled, with the
semantics in the WCAG checklist §D: error summary after a failed submit; `aria-invalid`
and `aria-describedby`; valid input preserved; `aria-busy` on submit; success announced with a
next step and an expected response window; **no "instant demo" promise**; a retry and a support
path on server error.

## 5. Consent copy (candidate wording — needs Legal/Privacy)

Service acknowledgment (required): "I have read the [Privacy Policy] and agree that Semester
may use my information to respond to this request."
Marketing (optional, unchecked, separate): "Send me occasional Semester news, resources and
event invitations." Under it: "Marketing updates are optional and are not required to request a
demo."
Because the privacy drafts (`docs/legal/PRIVACY-POLICY-DRAFT.md`, `docs/legal-drafts/PRIVACY-NOTICE-DRAFT.md`) are **unpublished**, the privacy link must point to
a page that exists and states its draft status; do not link to a page that does not.

## 6. Routes and internal handoff

Required new `cta_routes` rows: `security_report` (24 h), `privacy_request` (72 h), plus
`pilot_design` if the pilot form is distinct from `plan_institution_launch`. The existing
mapping creates `gtm_accounts`/`gtm_stakeholders` for institutional routes and a
`trust_room_requests` row for procurement. Nothing in `site_leads` or the GTM tables is exposed
to the browser.

## 7. Public read models (the other half of "public data")

Exposed through one Edge Function (`verify_jwt=false`, origin-restricted) that calls
service-role-only RPCs, never through anon-callable functions:
`marketing_public_navigation`, `_pricing`, `_resources(filters)`, `_resource(slug)`, `_faq(topic)`,
`_trust_summary`, `_status_summary`, `_case_studies`, `_product_updates`, `_integrations`.
Pricing returns an amount **only** when a pricing-approval record exists, otherwise a
`request_pricing` marker; the catalog tables are not read directly by marketing UI. A new Edge
Function needs a `config.toml` entry, a row in `docs/reference/EDGE-FUNCTIONS.md`,
`supabase/functions.snapshot`, and a DEPLOY note (`platform-reference.test.ts`,
`functionsdeployed.test.ts`, `functionconfig.test.ts`).

## 8. Migration rules (from the survey)

Version above `20261004191000` and above the ledger's watermark; idempotent
(`if not exists`, `drop policy if exists`), no `begin/commit`; explicit `enable row level
security`; `set search_path = ''` on every definer function; service-role-only RPCs are revoked
from `public, anon, authenticated` and granted to `service_role`; add a `*.check.sql` suite
(discovered by glob); run `supabase/check.sh <name>`.
