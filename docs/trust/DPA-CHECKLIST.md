# DPA Checklist and Student-Data Terms

**Status: `NOT_STARTED` as a signed agreement (HECVAT PRIV-4).** This page is
the product and legal requirements checklist a DPA must satisfy, plus
starting clause language. **It is not legal advice and not final contract
language.** Counsel drafts the agreement. Counsel has to adapt it for the
parties, state student-privacy law, whether GDPR applies, any HIPAA or COPPA
exposure, and the institution's own required addenda. The 1EdTech Data
Privacy and Security Agreement (DPSA) template is the sensible starting point
for the higher-ed sector.

Each clause says what Semester can support **today**, with the file that
shows it. A clause Semester cannot yet support says so. Signing a promise the
product cannot keep is worse than negotiating it.

## FERPA school-official checklist

`docs/FERPA-COPPA-1EDTECH-READINESS.md` keeps the FERPA, COPPA and 1EdTech
controls as a register with a status for each, enforced by test. This page is
the contract side of the same obligations.

FERPA lets an institution disclose education records without consent to a
"school official" with a legitimate educational interest. That covers a
contractor only when every line below holds:

- [ ] Semester performs a service or function the institution would
      otherwise use its own employees for.
- [ ] The contract designates Semester as a school official or service
      provider where applicable.
- [ ] The institution keeps direct control over the use and maintenance of
      education records.
- [ ] Semester uses records only for documented institutional purposes.
- [ ] Access is limited to legitimate educational interest and the minimum
      necessary data.
- [ ] Semester does not sell, rent, advertise against, profile, or
      commercially exploit education records.
- [ ] Semester does not use identifiable student records to train generalized
      models without specific written authorization.
- [ ] Semester re-discloses only to approved, contractually bound subprocessors.
- [ ] The institution can configure and approve AI, integrations, retention
      and access scope.
- [ ] Semester supports export, correction workflows where applicable,
      deletion, and deletion confirmation.
- [ ] Security-incident notification and cooperation duties are defined in
      the contract.
- [ ] Subprocessors receive equivalent confidentiality, security,
      use-limitation and deletion terms.

These boxes stay unticked until a signed agreement exists. The product-side
support for each is in the next table.

## Clause requirements, and what the product supports today

| Clause | Requirement | Semester today |
| --- | --- | --- |
| Parties and roles | Institution as customer/controller; Semester as service provider/processor | Needs a legal entity (see [`README.md`](README.md)) |
| Processing instructions | Only on documented institutional instructions and the stated purpose | Tenant policy is enforced server-side: `supabase/tenant-sso-policy.check.sql`, `supabase/intelligence-policy.check.sql` |
| Direct control | Institution directs use and maintenance of records | Institution admins hold capability grants: `supabase/capabilities.check.sql` |
| Legitimate educational interest | Access limited to the users and data the purpose needs | Capability-scoped access and consented, expiring staff access: `supabase/support-access.check.sql` |
| No sale or advertising | No sale, behavioral advertising, profiling or commercial exploitation | No advertising code exists; needs the written commitment |
| No secondary use | No product or external model training on identifiable records without written authorization | Institutional AI calls OpenAI with `store: false` (`app/server/institution/providers/openai.ts`). Both providers' published terms forbid training on API content without opt-in, recorded verbatim in [`PROVIDER-TERMS.md`](PROVIDER-TERMS.md); neither is accepted or signed by Semester |
| No re-disclosure | Only to approved subprocessors under equivalent terms | Subprocessors are listed in [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md); their DPAs are not reviewed |
| Data minimization | Each integration limited to minimum fields | Integration permission matrix: `docs/INTEGRATION-PERMISSION-MATRIX.md` |
| Security measures | A security schedule of technical and organizational measures | [`SECURITY-WHITEPAPER.md`](SECURITY-WHITEPAPER.md) is the draft of that schedule |
| Subprocessors | Current list, diligence, flow-down terms, notice and objection | List exists; diligence and notice process do not |
| Incident notification | Scope, initial deadline, update cadence, cooperation, remediation | Process in `docs/market-readiness/INCIDENT_RESPONSE.md`; never exercised. **No notification deadline should be signed until a tabletop has been run** |
| Data location | Approved hosting and processing locations | Not recorded; the Supabase region must be written down first |
| Data-subject requests | Access, correction, deletion cooperation | Student export and deletion exist and are tested: `app/src/lib/export.ts`, `app/src/lib/erase.ts`, `supabase/deletion.check.sql` |
| Retention | Active-term, backup, archive and legal-hold timelines | Every table has a retention answer, and the backups' lifecycle is stated (daily, 7-day rolling expiry per the plan tier's documentation and not yet read off the dashboard, PITR unconfirmed; a restore re-applies the deletions it can identify and names the ones it cannot): `RETENTION.md`, *Backups*. Archive and legal-hold timelines are not: no legal hold exists (RM-02) |
| Export and return | Portable export on termination, documented format | Per-student export exists; a whole-tenant export does not: `docs/DATA-PORTABILITY-AND-OFFBOARDING.md` |
| Deletion certification | Delete after contract end; certify on request | Per-account deletion exists; tenant-wide deletion and a certificate do not |
| Audit and assurance | Questionnaire, HECVAT, SOC 2, evidence-sharing process | HECVAT register exists; no SOC 2 report ([`SOC2-READINESS.md`](SOC2-READINESS.md)) |
| Accessibility | Accessibility commitment, VPAT/ACR, remediation process | No ACR yet (HECVAT A11Y-2) |
| AI governance | Approved models, data handling, retention, customer controls, human oversight, emergency disable | `docs/market-readiness/AI_GOVERNANCE.md` |
| Termination | Export, deletion, access revocation, transition duties | Depends on tenant-wide export and deletion, which do not exist yet |
| Order of precedence | How DPA, security schedule, pilot SOW, SLA and MSA interact | Counsel |

## Student and institution rights to preserve

- The institution controls the data scope.
- The institution controls whether AI features are enabled, for the tenant,
  a course, or a population.
- The institution controls course and assignment AI policy.
- The institution controls any sponsor or advertising settings, and the
  default is none.
- A student controls personal preferences and their eligible personal
  workspace data.

## Starting clause language

The text below is a drafting starting point for counsel. It is not
negotiated language. Bracketed items are open.

**Processing and educational purpose.** Processor shall process Student Data
solely to provide, secure, support, maintain and improve the contracted
Services in accordance with Customer's documented instructions and the
Agreement. Processor shall not process Student Data for advertising, sale,
behavioral targeting, commercial profiling, unrelated product development, or
any other independent purpose. Processor shall not use identifiable Student
Data to train a generalized or third-party AI model unless Customer gives
prior, specific, written authorization identifying the permitted data, model,
purpose, duration and retention controls.

**School-official relationship.** Where Customer relies on the FERPA
school-official exception, Processor acknowledges that it performs an
institutional service or function for Customer; is under Customer's direct
control with respect to the use and maintenance of Education Records; will
use Education Records only for the legitimate educational interests and
purposes specified by Customer; and will not re-disclose Education Records
except as authorized by Customer, permitted by applicable law, or necessary
for approved Subprocessors bound by written obligations at least as
protective as this Addendum.

**Data minimization and scope.** Customer will determine the Student Data
made available to Processor. Processor will support configuration that limits
collection, access, retention and use to the minimum reasonably necessary for
the documented Service purpose. Before production activation, the parties
will document each integration's data fields, system of record, purpose,
access roles, update frequency, retention period and authorized recipients.

**Security measures.** Processor will maintain appropriate technical and
organizational measures, including encryption in transit, role-based access
controls, MFA for privileged accounts, tenant isolation, secure software
development practices, logging and monitoring, vulnerability management,
backup and recovery processes, incident response procedures, and documented
subprocessor oversight.

> Before signing: MFA for privileged accounts (SOC 2 CC6-02) and tested
> backup and recovery (AV-07) are not yet in place. Either close them first,
> or have counsel attach a dated remediation schedule.

**Subprocessors.** Processor may engage Subprocessors only to deliver the
Services, will maintain an up-to-date list, and will impose written privacy,
confidentiality, security, use-restriction and deletion obligations no less
protective than this Addendum. Processor remains responsible for its
Subprocessors. Where required, Processor will give advance notice of material
Subprocessor changes and a reasonable objection process.

**AI-specific restrictions.** Customer controls whether AI features are
enabled for its tenant, course, program or user population. Processor will
identify approved AI providers and models, document the data categories sent
to each, apply configured retention and training restrictions, and provide an
emergency feature-disable mechanism. Processor will not represent AI output
as an official academic, financial-aid, registration, disciplinary, medical
or legal determination. High-impact actions require an authorized human
decision-maker.

**Incident notification.** Processor will notify Customer without undue
delay after confirming a Security Incident involving Customer Student Data,
and within [contractual period] where required by law or agreement. To the
extent known, the notice covers: the nature of the incident, affected systems
and data categories, the date range, containment actions, likely impact,
mitigation steps, and a responsible contact. Processor will provide
reasonable updates, cooperate with Customer's investigation and notification
obligations, preserve relevant evidence, and complete corrective actions.

**Retention, export, deletion.** Upon termination or Customer's documented
request, Processor will make Customer Student Data available for export in a
documented, commonly usable format, and will delete or render inaccessible
Customer Student Data within [defined period], except where retention is
required by law, a documented legal hold, or secure backup-retention
schedules. Processor will provide deletion confirmation on request.

**Audit and assurance.** Processor will reasonably cooperate with Customer's
security and privacy review, including HECVAT or equivalent questionnaires,
and will provide available independent assurance reports, bridge letters
where applicable, penetration-test summaries, accessibility evidence and
security-policy summaries, subject to confidentiality. Any on-site audit
right should be limited, risk-based, non-disruptive, used only when
documentation and independent assurance are insufficient, and given with
reasonable notice.
