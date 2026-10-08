#!/usr/bin/env python3
"""Render the five data-driven documents in docs/master from domains.py.

    python3 docs/master/tools/render.py        # from the repository root

Rewrites SEMESTER_DOMAIN_CATALOG.md, SEMESTER_CAPABILITY_MATRIX.md,
SEMESTER_DATA_AUTHORITY_MATRIX.md, SEMESTER_DOMAIN_REPLACEMENT_GATES.md and
the generated half of SEMESTER_MASTER_BACKLOG.md. The other eleven documents in
docs/master are hand-written. Edit domains.py, not the output.
"""
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))
import domains as dm  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..")
DS = dm.DOMAINS
ASOF = "2026-10-05"
BASE = "origin/main 790ebbf"

BANNER = (
    "<!-- Rendered from docs/master/tools/domains.py by docs/master/tools/render.py. "
    "Edit the data, then run `python3 docs/master/tools/render.py` from the repository root. -->"
)

CEILING = (
    "> **Claim ceiling.** Everything here is a reading of the repository at "
    f"{BASE} on {ASOF}, from read-only audits. Nothing was run in production, and no row is "
    "evidence of an activated tenant, a customer, or an approved claim. \"Verified\" means held by "
    "an automated test in this repository. It does not mean operating, supported, secure, accessible "
    "or approved. The repository's own registers hold the same ceiling "
    "([`PRODUCT-STATUS-MAP.md`](../PRODUCT-STATUS-MAP.md), "
    "[`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md))."
)


def w(name, text):
    with open(os.path.join(OUT, name), "w") as f:
        f.write(text.rstrip() + "\n")


def seatname(s):
    return f"`{s}`"


GATE_COLS = ["SEC", "PRIV", "A11Y", "INST", "MIG", "REC", "RBK"]
mat_all = [dm.NS, dm.DD, dm.PL, dm.NI, dm.NV, dm.IN, dm.TR, dm.PO]

# ---------------------------------------------------------------- catalog

UNIVERSAL = """\
## Universal fields

A domain card lists the fields that differ by domain. Every field it does not
list takes the universal answer below. This is stated once because the
alternative, forty copies of the same sentence, is how a copy goes stale.

| ID | Field | Universal answer (applies unless the card says otherwise) |
| --- | --- | --- |
| U-A11Y | Accessibility requirements | WCAG 2.2 AA is the build target for every screen in the domain, keyboard and screen-reader complete, with reduced-motion and contrast support. `app/src/a11y/` holds automated axe tests. **No qualified human evaluation exists (EXT-008 open), so no domain may claim "accessible" or "WCAG-conformant" (CLM-008 prohibited).** Release gate 3 of the replacement gates requires it. |
| U-SEC | Security requirements | A threat record per feature (`docs/security/THREAT-RECORD-TEMPLATE.md`); tenant isolation test per object class; server-side authorisation on every command; no secret in the browser; supply-chain gate in CI. Open findings that touch every domain: F-01 (tenant isolation off for every school, covers course rooms only), F-02 (tokens and user AI keys in `localStorage`), F-08 (no alerting), F-10 (audit tables not tamper-evident). See [`SEMESTER_TRUST_AND_GOVERNANCE_MODEL.md`](SEMESTER_TRUST_AND_GOVERNANCE_MODEL.md). |
| U-AUD | Audit requirements | A sensitive mutation writes an `audit_event` (pseudonymised actor and object, correlation id, tenant id with no foreign key so that removing a tenant keeps the evidence) and, where the domain has one, its own append-only audit table. Transactional outbox for sensitive mutations is ADR-0007 (proposed). |
| U-PRIV | Privacy and retention | Data class from `docs/trust/DATA-CLASSIFICATION-STANDARD.md` (T0 to T6; unknown is treated as T3); retention per `docs/trust/DATA-RETENTION-AND-DELETION-STANDARD.md`; export and erase through the account path; legal holds honoured by every sweep (`legal_holds`). Per-table classes are rule-derived and not human-reviewed. |
| U-SUP | Support model | Student asks in the app; the request goes to the owning office or to Semester support with minimal context; support access to a customer's data is time-limited, logged and customer-visible (`support_access_grant`, `support_access_event`). Today one person staffs it (docs/support, `OWNER-AND-ACCOUNTABILITY-MATRIX.md`). |
| U-INC | Incident model | `docs/trust/INCIDENT-RESPONSE-PLAN.md` and `docs/sre/06-INCIDENTS-AND-ON-CALL.md`: detect, validate, classify severity, contain, communicate, recover, post-mortem. **No alert reaches a person and no target-environment drill has run**, so no domain may claim 24/7 response (CLM-016 prohibited). |
| U-SLO | SLO and reliability | The domain's class in the SLO table below. All RTO/RPO values are targets and every one reads "unmeasured" in `docs/sre/07-RESILIENCE-BACKUP-DR-AND-CHAOS.md`. |
| U-DOCS | Required documentation | A requirement, a design, a threat record, a data map, a runbook, a support article, a release note and an evidence file under `docs/evidence/`. A page is governed by a card only if it lives under a governed directory (`app/src/lib/docs/card.ts`). |
| U-GATES | Release gates | The twenty gates in [`SEMESTER_DOMAIN_REPLACEMENT_GATES.md`](SEMESTER_DOMAIN_REPLACEMENT_GATES.md), plus the card's own review flags. |
| U-MIG | Migration, reconciliation, dual-run, cutover, rollback | Where a card has no entry, Semester is not replacing an external record in this domain and the fields are not applicable. Where Semester will hold or replace a record, the card states the plan and the generic factory is [`SEMESTER_MIGRATION_FACTORY.md`](SEMESTER_MIGRATION_FACTORY.md). |

### SLO classes

Defined in `docs/sre/07-RESILIENCE-BACKUP-DR-AND-CHAOS.md`. Targets, not measurements.

| Class | RTO target | RPO target | Drill cadence | Measured |
| --- | --- | --- | --- | --- |
| C0 | 60 min | 5 min | every 90 days | unmeasured |
| C1 | 4 h | 15 min | every 180 days | unmeasured |
| C2 | 24 h | 60 min | yearly | unmeasured |
| C3 | 72 h | 24 h | yearly | unmeasured |
"""

FIELDS36 = [
    ("Vision", "card"), ("Primary users", "card"), ("User jobs to be done", "card"),
    ("Current source of truth", "card"), ("Native Semester source of truth", "card"),
    ("Integration strategy", "card"), ("Data model", "card"), ("Tenant scope", "card"),
    ("Role/capability model", "card"), ("Data classification", "card"), ("Consent model", "card"),
    ("AI model/policy", "card"), ("Accessibility requirements", "U-A11Y"), ("Security requirements", "U-SEC (+ card risks)"),
    ("Audit requirements", "U-AUD"), ("Privacy/retention requirements", "U-PRIV"),
    ("Migration plan", "card `Migration` (else U-MIG)"), ("Reconciliation plan", "card `Migration`"),
    ("Dual-run plan", "card `Migration`"), ("Cutover criteria", "card `Migration` + replacement gates"),
    ("Rollback plan", "card `Migration`"), ("Support model", "U-SUP (+ card CS)"), ("Incident model", "U-INC"),
    ("SLO/reliability requirements", "card SLO class"), ("Commercial model", "card"), ("Customer success model", "card"),
    ("Outcome metrics", "card"), ("Required documentation", "U-DOCS"), ("Release gates", "U-GATES + card review flags"),
    ("Replacement authority gates", "card `Replacement authority` + replacement gates doc"), ("Team owner", "card"),
    ("Dependencies", "card"), ("Risks", "card"), ("Priority", "card"), ("Implementation branch", "card"), ("Tests", "card"),
]


def catalog():
    o = ["# Semester domain catalog", "", BANNER, "",
         f"**As of** {ASOF} · **Base** {BASE} · **Domains** {len(DS)} · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)", "",
         CEILING, "",
         "Forty domains, each defined on the thirty-six fields the master brief requires. A field that is the same in every domain is answered once under [Universal fields](#universal-fields); a field that differs is on the domain's card. [How each of the 36 fields is answered](#where-each-of-the-36-fields-is-answered) says which.", ""]
    o.append("## Index\n")
    o.append("| ID | Domain | Phase | Priority | Owner seat | Maturity | Readiness |")
    o.append("| --- | --- | ---: | --- | --- | --- | --- |")
    for d in DS:
        o.append(f"| [{d['id']}](#{d['id'].lower()}-{slug(d['name'])}) | {d['name']} | {d['ph']} | {d['pri']} | {seatname(d['seat'])} | {' + '.join(d['mat'])} | {d['ready']} |")
    o.append("")
    o.append("Phase numbers are the implementation phases in the master brief (0 truth, 1 foundation, 2 Student OS, 3 Learning OS, 4 Student Success, 5 Academic Core, 6 Campus Services, 7 Career, 8 Institutional OS, 9 Company OS, 10 Platform). Owner seats are the twelve launch-council seats in `app/src/lib/launchreadiness.ts`; today one person holds or acts in seven of them and none has signed (see the company operating system).")
    o.append("")
    o.append("## Where each of the 36 fields is answered\n")
    o.append("| # | Field | Where |")
    o.append("| ---: | --- | --- |")
    for i, (f, where) in enumerate(FIELDS36, 1):
        o.append(f"| {i} | {f} | {where} |")
    o.append("")
    o.append(UNIVERSAL)
    o.append("## Domain cards\n")
    for d in DS:
        o.append(card(d))
    return "\n".join(o)


def slug(n):
    return "".join(c if c.isalnum() else "-" for c in n.lower()).strip("-").replace("--", "-").replace("--", "-")


def card(d):
    g = ", ".join(dm.GATES[x] for x in d["gates"]) or "none beyond the universal gates"
    r = [f"### {d['id']} {d['name']}", "",
         f"**Phase** {d['ph']} · **Priority** {d['pri']} · **Owner seat** {seatname(d['seat'])} · **SLO class** {d['slo']} · **Branch** `{d['br']}`", "",
         f"**Classification** {' + '.join(d['mat'])} · repository ladder `{d['ladder']}` · **Readiness** {d['ready']}", "",
         f"**Review flags (open)** {g}", "",
         f"| Field | Answer |", "| --- | --- |",
         f"| Vision | {d['vision']} |",
         f"| Primary users | {d['users']} |",
         f"| Jobs to be done | {d['jobs']} |",
         f"| Current source of truth | {d['cur']} |",
         f"| Native Semester source of truth | {d['nat']} |",
         f"| Integration strategy | {d['integ']} |",
         f"| Data model | {d['model']} |",
         f"| Tenant scope | {d['scope']} |",
         f"| Role/capability model | {d['caps']} |",
         f"| Data classification | {d['cls']} |",
         f"| Consent model | {d['consent']} |",
         f"| AI model/policy | {d['ai']} |"]
    if d["cut"]:
        r.append(f"| Migration, reconciliation, dual-run, cutover, rollback | {d['cut']} |")
    else:
        r.append("| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |")
    r += [f"| Replacement authority gates | {d['repl'] or 'Not a replacement domain.'} |",
          f"| Commercial model | {d['comm']} |",
          f"| Customer success model | {d['cs']} |",
          f"| Outcome metrics | {d['kpi']} |",
          f"| Dependencies | {d['deps']} |",
          f"| Risks | {d['risks']} |",
          f"| Tests | {d['tests']} |",
          f"| Evidence (paths) | {'; '.join('`'+e+'`' for e in d['ev'])} |", ""]
    return "\n".join(r)


# ---------------------------------------------------------------- capability matrix

LABELS = [
    ("Native and verified", lambda d: dm.NV in d["mat"]),
    ("Native but incomplete", lambda d: dm.NI in d["mat"]),
    ("Integrated", lambda d: dm.IN in d["mat"]),
    ("Transitional", lambda d: dm.TR in d["mat"]),
    ("Pilot-only", lambda d: dm.PO in d["mat"]),
    ("Designed/documented", lambda d: dm.DD in d["mat"]),
    ("Planned", lambda d: dm.PL in d["mat"]),
    ("Not started", lambda d: dm.NS in d["mat"]),
    ("Requires security review", lambda d: "SEC" in d["gates"]),
    ("Requires privacy/legal review", lambda d: "PRIV" in d["gates"]),
    ("Requires accessibility review", lambda d: "A11Y" in d["gates"]),
    ("Requires institutional approval", lambda d: "INST" in d["gates"]),
    ("Requires migration", lambda d: "MIG" in d["gates"]),
    ("Requires reconciliation", lambda d: "REC" in d["gates"]),
    ("Requires rollback", lambda d: "RBK" in d["gates"]),
    ("Unsafe to activate", lambda d: d["ready"] == dm.UNSAFE),
    ("Ready for pilot", lambda d: False),
    ("Ready for production", lambda d: False),
    ("Ready to become authoritative system of record", lambda d: False),
]

# (domain id, capability, maturity label, readiness/notes, evidence)
CAPS = [
    ("D01", "Today / Action Center", "Native but incomplete", "Default-on with `VITE_TODAY_ACTION_CENTER=off` rollback; runs on device state and a seeded sample; no institution data", "app/src/lib/today-center.ts"),
    ("D01", "Source-freshness cards", "Native but incomplete", "Off (module.source_freshness_cards)", "app/src/lib/flags.ts"),
    ("D02", "Calendar (ICS publish and import)", "Native but incomplete", "Edge functions `calendar` and `fetchcal` built; capability-token URL", "supabase/functions/calendar/"),
    ("D02", "Tasks and notes", "Native but incomplete", "Device-first; sync optional", "app/src/domains/tasks"),
    ("D02", "Productivity service and API v1", "Native but incomplete", "Real service with Postgres repository and OpenAPI; mounted at /api/productivity but off unless a deployment enables it", "app/server/productivity/"),
    ("D02", "Documents (Write, Sheet, Deck)", "Native but incomplete", "Office-format import/export tested; files IndexedDB-only, never synced", "app/src/lib/docx"),
    ("D02", "Mail", "Native but incomplete", "Drafts only; never sends", "app/src/lib/mailbox"),
    ("D02", "Offline sync engine", "Native but incomplete", "Package built; used only behind `offline_engine_tasks` (off)", "packages/offline-sync/"),
    ("D03", "Degree and graduation planning", "Native but incomplete", "Client logic over student-entered data; native catalog/audit row not-started", "app/src/lib/degree.ts"),
    ("D04", "Course Studio authoring", "Native but incomplete", "Flag `course_studio` off; offered only to designated faculty", "app/src/lib/coursestudio.ts"),
    ("D04", "LTI 1.3 tool (launch, deep link, AGS, NRPS)", "Integrated", "Code built; 0 platform registrations exist; Brightspace registration pending", "supabase/functions/lti/"),
    ("D05", "Gradebook ledger and passback", "Native but incomplete", "Off at every school; no preview, no stub", "app/src/lib/gradebook/"),
    ("D05", "QTI 3 import/export", "Native but incomplete", "Library and tests; no real faculty content migrated", "app/src/lib/assessment/qti.ts"),
    ("D06", "AI proxy with monthly cap", "Native but incomplete", "Built; shared Semester key blocked pending provider activation", "supabase/functions/claude/"),
    ("D06", "AI kill switch", "Native but incomplete", "One production drill 3 of 3 (2026-09-29); BYOK path bypasses it (F-04)", "docs/evidence/ai/"),
    ("D06", "AI injection red-team", "Native but incomplete", "21 of 21 canaries held; one run, one model", "docs/evidence/ai/"),
    ("D06", "Institutional AI gateway endpoints", "Native but incomplete", "Routes exist; whether deployed is UNKNOWN-INVESTIGATE; answers 503 without sandbox", "app/server/institution/intelligence.ts"),
    ("D07", "Client-side search", "Native but incomplete", "Over registry, guide and own data; no server index", "app/src/lib/find.ts"),
    ("D09", "Advisor meeting mode and shares", "Native but incomplete", "Flag off; shares and events tables built", "app/src/components/AdvisorMeeting.tsx"),
    ("D10", "Registrar bridge", "Transitional", "Clipboard-style handoff by design", "app/src/lib/registrar.ts"),
    ("D11", "Academic record ledger", "Native but incomplete", "Staff-side, flag off; states it is not an official transcript", "app/src/lib/record/ledger.ts"),
    ("D12", "Registration transaction", "Native but incomplete", "Closed at every school; sandbox demo only", "app/src/lib/enrollment/"),
    ("D12", "Registration-day planner", "Native but incomplete", "Device-only; flag off", "app/src/lib/registration-day.ts"),
    ("D13", "Student accounts ledger", "Native but incomplete", "Built; no payment-provider connection; nothing sent to students", "app/src/lib/finance/accounts.ts"),
    ("D13", "Individual subscription (Stripe)", "Pilot-only", "One live $7.99 monthly checkout and cancel executed 2026-10-03; checkout held off by flag", "docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md"),
    ("D14", "Aid checklist and handoff", "Transitional", "Tracker never computes eligibility", "app/src/screens/Opportunities.tsx"),
    ("D16", "Housing status and handoff", "Pilot-only", "Sandbox adapter only", "app/server/institution/housing.ts"),
    ("D17", "Dining service and ledger", "Native but incomplete", "Behind module.dining; ordering needs a live partner", "app/src/lib/dining/"),
    ("D19", "Community foundation (feed, circles, moderation)", "Native but incomplete", "Foundation flags follow preview; high-risk flags refuse production", "app/src/community/"),
    ("D19", "Volunteer moderation and scoped pseudonymity", "Native but incomplete", "High-risk; refused in production by design", "app/src/community/flags.ts"),
    ("D21", "Institutional safety escalation webhook", "Native but incomplete", "Signed, allow-listed, two-reviewer; off", "supabase/functions/_shared/escalation.ts"),
    ("D20", "Accommodation passports", "Designed/documented", "Schema and check suites; no institutional service in code", "supabase/migrations/"),
    ("D23", "Skills and portfolio", "Native but incomplete", "Self-reported claims labelled; no employer surface", "app/src/lib/career-evidence.ts"),
    ("D24", "Family grants and guardian links", "Native but incomplete", "High-risk activation profile; not activated", "app/src/lib/family.ts"),
    ("D25", "Configuration Studio, Workflow Builder", "Native but incomplete", "Staff-side, preview only", "app/src/components/institutional/"),
    ("D25", "Platform engines (policy, workflow, entitlements)", "Native but incomplete", "13 test files; 0 importers from app/src or app/server; `decide()` has one non-test caller", "packages/platform/"),
    ("D26", "Membership-derived SSO binding", "Native but incomplete", "Migrations and gateway auth exist; no real IdP connected; SAML code not found outside docs (verify)", "app/server/institution/auth.ts"),
    ("D26", "SCIM 2.0", "Native but incomplete", "Off unless SEMESTER_SCIM is set to on", "app/server/institution/scim.ts"),
    ("D27", "Integration control plane (scopes, sync, dead letter, drift)", "Native but incomplete", "Tables, worker and 15-minute tick built; adapter list is empty", "app/server/integration/"),
    ("D27", "OneRoster / Edu-API", "Designed/documented", "No client code found; a register concept", "docs/INTEROPERABILITY-ROADMAP.md"),
    ("D28", "Retention sweeps and legal holds", "Native but incomplete", "Schema and scheduled sweeps; schedule contents not reviewed", "supabase/scheduler.sql"),
    ("D28", "Account export and delete", "Native but incomplete", "Synthetic account exercised 2026-10-01", "docs/launch/2026-10-01-production-availability.md"),
    ("D29", "Row-level security", "Native but incomplete", "Enabled on all 354 objects; forced on none; 33 public and 28 private tables have no policy", "database/TENANT_ISOLATION_MATRIX.md"),
    ("D29", "Audit log and hash-chained ledgers", "Native but incomplete", "Tables built; not yet tamper-evident across all audit tables (F-10)", "supabase/migrations/"),
    ("D30", "Trust room", "Native but incomplete", "Edge function and private bucket; no customer", "supabase/functions/trust-room/"),
    ("D31", "Operations console", "Native but incomplete", "MFA step-up; one operator", "app/src/screens/Console.tsx"),
    ("D32", "Institutional billing", "Designed/documented", "DOCUMENTED-UNIMPLEMENTED in the baseline audit", "docs/program/BASELINE_AUDIT.md"),
    ("D33", "Company site", "Native but incomplete", "Static; deployed revision unverified; 15 statements over evidence", "company-site/"),
    ("D34", "Productivity OpenAPI contract", "Native but incomplete", "The only published API contract", "docs/api/productivity.v1.openapi.json"),
    ("D35", "Marketplace", "Not started", "Governance documents only", "docs/EXTENSION-ECOSYSTEM-GOVERNANCE.md"),
    ("D37", "Production restore", "Not started", "Never done; only a logical rehearsal on a throwaway database", "docs/evidence/restore/2026-09-30-logical-rehearsal.md"),
    ("D37", "Terraform and drift detection", "Designed/documented", "Written; nothing applied; drift reports NOT CHECKED", "infra/README.md"),
]


def capability_matrix():
    o = ["# Semester capability matrix", "", BANNER, "",
         f"**As of** {ASOF} · **Base** {BASE} · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)", "", CEILING, "",
         "## How a capability is classified", "",
         "The brief asks for nineteen labels. They are not one scale, so they are held on three axes and a capability carries one label from each of the first and third, and any number from the second.", "",
         "| Axis | Question | Values |", "| --- | --- | --- |",
         "| A. Maturity | What is built? | Not started; Planned; Designed/documented; Native but incomplete; Native and verified; Integrated; Transitional; Pilot-only |",
         "| B. Review gates | What review is owed and not evidenced? | Security; Privacy/legal; Accessibility; Institutional approval; Migration; Reconciliation; Rollback |",
         "| C. Readiness | May it be switched on? | Unsafe to activate; Not ready; Conditional (invitation-only individual validation); Ready for pilot; Ready for production; Ready to become authoritative system of record |", "",
         "### Mapping to the repository's own ladders", "",
         "| This matrix | `replaceregister.ts` ladder | Activation register | Master Launch Readiness |", "| --- | --- | --- | --- |",
         "| Not started / Planned | not-started | L0 to L1 | not-started |",
         "| Designed/documented | designed | L1 | designed |",
         "| Native but incomplete | building (or tested for its best piece) | L2 | building |",
         "| Native and verified (repo-level) | tested | L3 | tested |",
         "| (nothing yet) | | L4 and above | evidenced, operational, launch-approved |", "",
         "**Native and verified means held by an automated test in this repository and nothing more.** No domain is rated Native and verified in the first table below because every domain has an open gap its own register names; the label is defined so that it can be earned. Master register: 0 of 142 rows are `operational` or `launch-approved`, and one is `evidenced` (AI-012). \"Integrated\" means a working, tested connection to an external system exists; the only candidate (LTI 1.3) has zero registrations. \"Pilot-only\" means exercised only in a sandbox or a single live test.", "",
         "### Readiness values, defined", "",
         "| Value | Meaning | Domains today |", "| --- | --- | --- |",
         f"| Unsafe to activate | A high-risk capability (money, records, grades, safety, family, identity, integration) whose activation profile is not complete. A flag must not be turned on for a tenant. | {sum(1 for d in DS if d['ready']==dm.UNSAFE)} |",
         f"| Not ready | Not approved for a tenant; no known harm in staying off. | {sum(1 for d in DS if d['ready']==dm.NOTREADY)} |",
         f"| Conditional: invitation-only individual validation | `GO-NO-GO-DECISION.md` motion 1 (CONDITIONAL GO / YELLOW): unpaid, invitation-only, device-local use. Not activated. | {sum(1 for d in DS if d['ready']==dm.COND)} |",
         "| Ready for pilot | The pilot checklist in the replacement gates is complete for a named tenant, with a signed agreement and approved data scope. | 0 |",
         "| Ready for production | Pilot exit criteria met, evidence current, support and rollback rehearsed. | 0 |",
         "| Ready to become authoritative system of record | All 15 replaceability requirements tested, institutional authority, reconciliation, rollback. | 0 |", "",
         "## Domain matrix", "",
         "| ID | Domain | Maturity | Ladder | SEC | PRIV | A11Y | INST | MIG | REC | RBK | Readiness |",
         "| --- | --- | --- | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | --- |"]
    for d in DS:
        cells = " | ".join("●" if c in d["gates"] else "" for c in GATE_COLS)
        o.append(f"| {d['id']} | {d['name']} | {' + '.join(d['mat'])} | {d['ladder']} | {cells} | {d['ready']} |")
    o += ["", "● = the review is required and no evidence of it exists in the repository. SEC, PRIV and A11Y are universal wherever their rule holds (security: every domain through D37; privacy: every domain that holds personal data; accessibility: every user-facing domain), because no independent security assessment (EXT-006), qualified accessibility evaluation (EXT-008) or counsel review (EXT-002, EXT-003) exists for any of them. INST, MIG, REC and RBK are domain-specific.", "",
          "### Totals", ""]
    c = Counter(m for d in DS for m in d["mat"])
    o += ["| Maturity label | Domains carrying it |", "| --- | ---: |"]
    for m in mat_all:
        o.append(f"| {m} | {c.get(m, 0)} |")
    o += ["", "## Index by requested label", "",
          "Every one of the nineteen labels in the brief, and the domains that carry it today.", "",
          "| Label | Count | Domains |", "| --- | ---: | --- |"]
    for name, fn in LABELS:
        ids = [d["id"] for d in DS if fn(d)]
        o.append(f"| {name} | {len(ids)} | {', '.join(ids) if ids else 'none'} |")
    o += ["", "## Capability register (named capabilities)", "",
          "Domain ratings are the lowest honest reading of their capabilities. The repository's row-level register is [`docs/program/CAPABILITY_TRACEABILITY_MATRIX.md`](../program/CAPABILITY_TRACEABILITY_MATRIX.md) (105 rows: 60 `CAP-001` to `CAP-060` plus 45 proposed). This table is the cross-domain view of the capabilities that decide the ratings above; it adds none that the audits did not read in code.", "",
          "| Domain | Capability | Maturity | State and limit | Evidence |", "| --- | --- | --- | --- | --- |"]
    for dom, cap, mat, note, ev in CAPS:
        o.append(f"| {dom} | {cap} | {mat} | {note} | `{ev}` |")
    o += ["", "## Known disagreements between the repository's registers", "",
          "These were found while building this matrix and are not resolved here. Each is a decision for the owner of the named register, or a measurement to take.", "",
          "| # | Disagreement | Where | Likely resolution |", "| ---: | --- | --- | --- |",
          "| 1 | All 60 capabilities read `verified` and L3, while runtime exposure shows 0 `live`, 0 `pilot`, 49 `early_access`, 11 `institution_controlled` | `PRODUCT-STATUS-MAP.md`, `docs/product/capability-inventory.md`, baseline audit R-029 | The status map's value is a register value, not a production check; read it as repository maturity only |",
          "| 2 | Activation register: 22 standard, 33 controlled, 5 high-risk. Status map: 44 standard, 11 controlled, 5 high-risk | `CAPABILITY-ACTIVATION-REGISTER.md`, `PRODUCT-STATUS-MAP.md` | One is stale; regenerate both with `npm run registers` and compare |",
          "| 3 | Student-portal row says the five-destination shell is flagged off; `experience-flags.ts` makes `journeyNavigation` default to production | `DOMAIN-REPLACEMENT-REGISTER.md`, `app/src/lib/experience-flags.ts:90` | Register row is stale |",
          "| 4 | Council seats: seven held (launchreadiness.ts) vs four held (council doc); the security seat is vacant in `COUNCIL` but the owner matrix names the founder as security primary | `launchreadiness.ts`, `LAUNCH-READINESS-COUNCIL.md`, `OWNER-AND-ACCOUNTABILITY-MATRIX.md` | RAID-I02; holding a seat is not signing |",
          "| 5 | Replacement register says SAML only (no OIDC); the code audit found no SAML protocol code outside docs and registers | `DOMAIN-REPLACEMENT-REGISTER.md`, code | Possibly Supabase Auth carries SAML; verify and record in `docs/evidence/` |",
          "| 6 | Subprocessor register says Stripe is not active until keys are set; the live acceptance record shows live-mode keys were used on 2026-10-03 | `SUBPROCESSORS.md`, `docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md` | Update the register |",
          "| 7 | `docs/launch/2026-10-01-production-availability.md` records \"owner confirmed legal and independent reviews complete\"; later documents treat all of them as OPEN | that file, `EXTERNAL-EVIDENCE-QUEUE.md` | The note supplies no report; the queue is correct |",
          "| 8 | The truth table says `docs/evidence/` does not exist; it now does | `FEATURE-TRUTH-TABLE.md` | Update the truth table |",
          "| 9 | Domain replacement register's per-section row totals do not sum to the printed total (95) | `DOMAIN-REPLACEMENT-REGISTER.md` | Reconcile against `replaceregister.ts` |",
          "| 10 | `database/README.md` says 106 check suites; there are 111 `supabase/*.check.sql` files | `database/README.md` | Update the count |",
          ""]
    return "\n".join(o)


# ---------------------------------------------------------------- authority

AUTH = {
    "D01": ("S+X", "Semester holds the student's own plan; institution facts are labelled imports"),
    "D02": ("S", "Student-owned content"),
    "D03": ("X", "Institution degree audit is official; Semester plan is an estimate"),
    "D04": ("X", "LMS is the course record; Semester holds guidance and rules"),
    "D05": ("X", "LMS gradebook is the grade record; native ledger is a candidate"),
    "D06": ("S", "Semester owns policy, usage and audit; model providers process"),
    "D07": ("S", "Index is derived; each object keeps its owner's authority"),
    "D08": ("X", "LMS and institution for course records"),
    "D09": ("X", "Advising system for case notes; Semester for student-controlled shares"),
    "D10": ("X", "SIS"),
    "D11": ("X", "SIS; native ledger is a candidate and is not a transcript"),
    "D12": ("X", "SIS; native transaction closed"),
    "D13": ("X", "Bursar/ERP and payment provider; native ledger is a candidate"),
    "D14": ("X", "Aid office systems"),
    "D15": ("X", "Each office"),
    "D16": ("X", "Housing system"),
    "D17": ("X", "Dining partner"),
    "D18": ("X", "Campus event systems"),
    "D19": ("S", "Semester holds community content and moderation records"),
    "D20": ("X", "Disability services case system"),
    "D21": ("X", "Institution's emergency protocol; Semester is never the system"),
    "D22": ("X", "Library systems"),
    "D23": ("S+X", "Student-owned evidence; institution-issued credentials are institution-authoritative"),
    "D24": ("S", "Semester holds the consent ledger"),
    "D25": ("S", "Semester holds tenant configuration"),
    "D26": ("X", "Institution IdP is the identity authority; Semester holds membership and grants"),
    "D27": ("S", "Semester holds connection metadata; each source keeps its data"),
    "D28": ("S", "Semester holds its own retention and consent state"),
    "D29": ("S", "Semester holds its own audit"),
    "D30": ("S", "Semester holds its evidence; counsel and assessors hold their opinions"),
    "D31": ("S", "Internal"),
    "D32": ("S", "Semester holds individual subscriptions; institutions hold contracts"),
    "D33": ("C", "Company-internal"),
    "D34": ("S", "Contract and keys"),
    "D35": ("S", "Not started"),
    "D36": ("S", "Derived aggregates; sources keep authority"),
    "D37": ("C", "Company-internal"),
    "D38": ("C", "Company-internal"),
    "D39": ("C", "Company-internal"),
    "D40": ("C", "Company-internal"),
}


def authority():
    o = ["# Semester data authority matrix", "", BANNER, "",
         f"**As of** {ASOF} · **Base** {BASE} · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)", "", CEILING, "",
         "## The rule", "",
         "> A fact has exactly one authoritative holder per tenant per domain. Every surface says who, and says how fresh. A native Semester record becomes authoritative for an institution's data only by passing the replacement gates and a signed change record. It never becomes authoritative because it is convenient.", "",
         "Where the repository already states precedence, this matrix uses it: `docs/platform/PRIMITIVES.md` (integration source precedence: institution, then connected, then imported, then native, then AI), `docs/architecture/data-architecture/02-source-of-truth-matrix.md` (which says \"precedence is a label, not a rule\"), and the seven source states in `app/src/lib/source.ts` and `app/src/lib/integration/freshness.ts` (Institution verified, Imported, Student entered, Estimated, Needs review, Stale, Unavailable).", "",
         "### Authority classes", "",
         "| Class | Meaning |", "| --- | --- |",
         "| S | Semester is the system of record today, for data it owns: student-owned content, consent, its own audit, usage, tenant configuration, subscriptions |",
         "| X | An external system is the record. Semester reads, plans, explains and hands off. A native candidate may exist but is not authoritative |",
         "| S+X | Split: Semester holds the student-owned part, an external system holds the official part |",
         "| C | Company-internal; no student or institution data |", "",
         "### Eight things a surface must never blur", "",
         "From the brief and the platform constitution. Every screen labels which of these a value is.", "",
         "| Kind | Authority | Example |", "| --- | --- | --- |",
         "| Official record | Institution | A grade, a transcript, an enrolment |",
         "| Guidance | Institution or faculty | A policy page, course guidance |",
         "| Recommendation | Semester logic, explained | A suggested next step |",
         "| Student-owned content | Student | A note, a plan |",
         "| Institutional content | Institution | A syllabus the institution published |",
         "| External source | Third party | A calendar feed, a public page |",
         "| AI-generated content | Never authoritative | A summary, a draft |",
         "| Community-generated content | Authors, under moderation | A post |", "",
         "## Domain authority", "",
         "| ID | Domain | Class | Holder today | Native target | Replacement authority needed |", "| --- | --- | :-: | --- | --- | --- |"]
    for d in DS:
        cl, why = AUTH[d["id"]]
        o.append(f"| {d['id']} | {d['name']} | {cl} | {d['cur']} | {d['nat']} | {d['repl'] or 'None: not a replacement domain.'} |")
    o += ["", "Why each class was chosen:", ""]
    for d in DS:
        o.append(f"- **{d['id']}** ({AUTH[d['id']][0]}): {AUTH[d['id']][1]}.")
    o += ["", "## Class totals", ""]
    c = Counter(AUTH[d["id"]][0] for d in DS)
    for k in ["S", "X", "S+X", "C"]:
        o.append(f"- {k}: {c.get(k, 0)}")
    o += ["", "No domain holds a native record that is authoritative for an institution's data. That is the honest state: the replacement register reads \"Today: 0 of 14\" domains replaceable.", "",
          "## Authority transitions", "",
          "A domain moves from X to Semester-authoritative for one tenant only through this sequence, every step evidenced under `docs/evidence/`:", "",
          "1. Connect read-only; label every value with its source and freshness.",
          "2. Import with lineage; reconcile (counts, checksums, field-level differences) until the exception queue is empty or explained.",
          "3. Shadow-write in a sandbox; compare outcomes.",
          "4. Dual-run one unit (a course, a window, a term) with the external system still authoritative.",
          "5. Institution signs a change record; two people approve; effective date stated.",
          "6. Cut over; keep the external system read-only for a rollback window.",
          "7. Rehearse the rollback before step 5 and again after.", "",
          "The generic procedure is [`SEMESTER_MIGRATION_FACTORY.md`](SEMESTER_MIGRATION_FACTORY.md). The gates are [`SEMESTER_DOMAIN_REPLACEMENT_GATES.md`](SEMESTER_DOMAIN_REPLACEMENT_GATES.md).", ""]
    return "\n".join(o)


# ---------------------------------------------------------------- replacement gates

TWENTY = [
    "Product requirement", "Design specification", "Accessibility review", "Data classification", "Permission model",
    "Tenant isolation", "Source authority", "Audit model", "Security threat model", "Privacy/retention plan",
    "AI policy, if AI is involved", "Integration plan", "Migration plan", "Rollback plan", "Support playbook",
    "Monitoring/SLO", "Test suite", "Documentation", "Release evidence", "Owner and review date",
]
REQS = [
    ("r-record", "Authoritative data ownership", "tested", "every domain names an external record-holder"),
    ("r-lifecycle", "Lifecycle management", "building", ""),
    ("r-roles", "Roles and permissions", "tested", ""),
    ("r-approvals", "Approvals and separation of duties", "tested", ""),
    ("r-audit", "Audit", "tested", ""),
    ("r-migration", "Migration", "building", ""),
    ("r-parallel", "Parallel run", "tested", ""),
    ("r-reconcile", "Reconciliation", "tested", ""),
    ("r-reporting", "Reporting", "tested", ""),
    ("r-export", "Export and portability", "tested", ""),
    ("r-a11y", "Accessibility", "tested", ""),
    ("r-recovery", "Recovery", "tested", "production has never been restored"),
    ("r-change", "Change management and training", "designed", "no training exists for any role"),
    ("r-contract", "Contract and SLA", "building", "no signed SLA"),
    ("r-exit", "Exit and offboarding", "building", ""),
]


def gates():
    o = ["# Semester domain replacement gates", "", BANNER, "",
         f"**As of** {ASOF} · **Base** {BASE} · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)", "", CEILING, "",
         "## Doctrine", "",
         "**Build everything natively. Integrate responsibly. Replace only with proof. Operate every domain as one system.**", "",
         "This page makes \"only with proof\" testable. It extends, and does not replace, [`docs/DOMAIN-REPLACEMENT-REGISTER.md`](../DOMAIN-REPLACEMENT-REGISTER.md) (rendered from `app/src/lib/replaceregister.ts`), which already counts a domain replaceable only when its native row and all fifteen replaceability requirements are `tested`. **Today: 0 of 14.** The five requirements that stop every domain are `r-lifecycle`, `r-migration`, `r-change`, `r-contract` and `r-exit`.", "",
         "Do not replace official institutional records, identity, registration, grades, financial accounts, legal processes or high-stakes decisions without formal institutional authority, migration, reconciliation, audit, rollback and operational readiness. Semester never replaces an emergency-response system.", "",
         "## Four ways a domain runs", "",
         "From D-143: (1) Semester runs it natively; (2) Semester synchronises and governs a transitional external domain; (3) a partner supplies regulated infrastructure; (4) an official handoff until native replacement is authorised. A domain is in exactly one mode per tenant.", "",
         "## The four stages a capability passes", "",
         "| Stage | Meaning | Exit evidence (all current, under `docs/evidence/`) |", "| --- | --- | --- |",
         "| G-A Ready for pilot | A named tenant and cohort can use it with synthetic or approved data, without it becoming the record | Signed pilot agreement; approved data scope and map; named customer and Semester owners (both seats filled, a backup each); accessibility evaluation of the in-scope screens; tenant-isolation negative suite green for every object class touched; restore of the touched data measured; support route staffed; kill switch drilled; claims limited to the claim library; counsel-reviewed paper (EXT-002, EXT-003) |",
         "| G-B Ready for production | Pilot exit criteria met; may serve the tenant's real users | Pilot scorecard met against pre-agreed outcomes (docs/commercial/PILOT-SCORECARD.md); no open High finding; independent security assessment complete (EXT-006); alerts reach a person and were tested (EXT-010); target-environment drills (EXT-011); SLO measured for 30 days; DPA executed; subprocessors approved; rollback rehearsed |",
         "| G-C Ready to become authoritative system of record | Institution may retire the external system for this domain | All fifteen replaceability requirements tested; institution's board or officer authorises in writing; reconciliation clean for the agreed number of terms; two-person approvals enforced in the database; rollback rehearsed within the last 90 days; exit and offboarding export verified; named steward; legal review; auditor or registrar sign-off where the domain is regulated |",
         "| G-D Repeatable | A second tenant adopts it without bespoke engineering | Time-to-activate measured on two tenants; runbook used by someone other than its author (L9) |", "",
         "Nothing has passed G-A. The paid institutional pilot and broad enterprise sale are NO-GO / RED and the design-partner pilot is GO / GREEN for non-activation engagement only (`GO-NO-GO-DECISION.md`, 2026-10-03).", "",
         "## The twenty release and replacement gates", "",
         "No feature, domain, migration or institutional capability is complete until it has all twenty (master brief, section 16). The \"where it is held\" column says what in this repository would carry the evidence; \"typical gap\" is true of most domains today.", "",
         "| # | Gate | Where it is held | Typical gap today |", "| ---: | --- | --- | --- |"]
    held = [
        ("`docs/product/capability-registry.md`", "requirement exists; no named customer need"),
        ("`docs/design/`, domain design pages", "present for most domains"),
        ("`app/src/a11y/` (automated); EXT-008 (human)", "**no human evaluation; no ACR**"),
        ("`database/DATA_CLASSIFICATION_REGISTER.md`", "classes rule-derived, not reviewed"),
        ("`docs/ROLE-PERMISSION-MATRIX.md` (69 roles, 84 capabilities)", "present; attribute rules live in policies"),
        ("`database/TENANT_ISOLATION_MATRIX.md`; `docs/security/TENANT-ISOLATION-VERIFICATION.md`", "**no negative suite per object class; isolation off for every school (F-01)**"),
        ("`docs/platform/PRIMITIVES.md`; source states", "label exists; not a rule"),
        ("`audit_event`; ADR-0007", "not tamper-evident everywhere (F-10)"),
        ("`docs/security/THREAT-RECORD-TEMPLATE.md`; `docs/trust/THREAT-MODEL.md`", "template; few per-feature records"),
        ("`docs/trust/DATA-RETENTION-AND-DELETION-STANDARD.md`", "counsel review open"),
        ("`docs/ai-toolkit/`, `docs/operating-model/AI-LIFECYCLE-GATES.md`", "evals thin; BYOK bypass (F-04)"),
        ("`docs/INTEGRATION-CONTROL-PLANE.md`", "no real connection"),
        ("`docs/DATA-MIGRATION-PLAN.md`; `docs/platform/MIGRATION.md`", "no rehearsal with real data"),
        ("`ROLLBACK.md`; `RESTORE.md`", "**restore never run on production**"),
        ("`docs/support/`", "one person; no staffed route"),
        ("`docs/sre/`", "**RTO/RPO unmeasured; no alert reaches a person**"),
        ("`app/src/**/*.test.*` (1,340 files); `supabase/*.check.sql` (111)", "strong at repo level; main CI red 26 of last 30"),
        ("`docs/` (about 300 pages)", "drift between registers (see capability matrix)"),
        ("`docs/evidence/`", "a handful of repo-scoped or one-observation items; no external evidence"),
        ("`OWNER-AND-ACCOUNTABILITY-MATRIX.md`; `docs/documentation/` cards", "one person is owner and reviewer; backups unassigned"),
    ]
    for i, (g, (h, gap)) in enumerate(zip(TWENTY, held), 1):
        o.append(f"| {i} | {g} | {h} | {gap} |")
    o += ["", "## The fifteen replaceability requirements", "",
          "Verbatim ids from `replaceregister.ts` as of its 2026-09-29 reading.", "",
          "| Id | Requirement | Status | Gap |", "| --- | --- | --- | --- |"]
    for i, n, s, g in REQS:
        o.append(f"| `{i}` | {n} | {s} | {g} |")
    o += ["", "## Per-domain gate status", "",
          "Readiness and open review flags come from `domains.py`. \"Authority gate\" is what the institution or a regulator must supply and the product cannot.", "",
          "| ID | Domain | Mode today | Readiness | Open review flags | Authority gate |", "| --- | --- | --- | --- | --- | --- |"]
    for d in DS:
        mode = {"S": "Native (own data)", "X": "Handoff / connect (external is record)", "S+X": "Split", "C": "Company-internal"}[AUTH[d["id"]][0]]
        fl = ", ".join(d["gates"]) or "none"
        o.append(f"| {d['id']} | {d['name']} | {mode} | {d['ready']} | {fl} | {d['repl'] or 'n/a'} |")
    o += ["", "## Regulated and never-native domains", "",
          "| Domain | Position |", "| --- | --- |",
          "| Emergency response (D21) | Semester is a handoff to the institution's protocol and never the system. |",
          "| Financial aid (D14) | Handoff. The register says not to claim native until regulatory expertise exists. |",
          "| Payments (D13) | Hosted provider only; raw card data is never stored; Semester stays out of PCI scope. |",
          "| Identity provider (D26) | Not replaced; Semester integrates with the institution's IdP. |",
          "| Health and counselling records | Out of scope; handoff only (`docs/DO-NOT-BUILD.md`). |",
          "| Legal processes | Counsel owns; Semester provides workflow and evidence only. |", "",
          "## Pilot checklist (G-A) as a form", "",
          "```",
          "Tenant:                      Cohort:                    Domain(s):",
          "[ ] signed pilot agreement   [ ] data scope + map       [ ] named owner (both sides) + backups",
          "[ ] isolation negatives green for touched objects         [ ] restore measured for touched data",
          "[ ] accessibility evaluation of in-scope screens          [ ] kill switch drilled",
          "[ ] support route staffed + status page                   [ ] claims limited to the library",
          "[ ] counsel-reviewed paper                                [ ] exit/offboarding export rehearsed",
          "Reviewer who is not the owner: ______   Date: ______",
          "```", ""]
    return "\n".join(o)


# ---------------------------------------------------------------- backlog (generated half)

CROSS = [
    ("P0", "X-01", "Fix `main` CI red (stale generated counts after merges; load timing gate) and apply the `main` ruleset requiring `build`, `account-sync`, `secrets`", "operations", "26 of the last 30 `main` runs failed (docs/evidence/operations/2026-10-04-main-ci-red-diagnosis.md)", "Phase 1 step 0a/0b"),
    ("P0", "X-02", "Run the restore drill into the second project; record measured RTO/RPO in `RESTORE.md` and `docs/evidence/restore/`", "operations", "Never done on production; gate G5 UNMET", "Phase 1 step 1"),
    ("P0", "X-03", "Write the cross-tenant negative suite per object class and run it in CI", "security", "Risk R-001; F-01", "Phase 1; ADR-0002"),
    ("P0", "X-04", "Apply the anon grant reduction after staging proof; write the `authenticated` allowlist", "security", "`anon` holds DML on 32 public tables; 24 carry TRUNCATE", "Phase 1 step 2"),
    ("P0", "X-05", "Deliver one alert to a person and record the test (F-08)", "operations", "No alerting exists", "EXT-010"),
    ("P0", "X-06", "Name a second person for security, privacy and release review; assign a backup for every seat", "founder", "One person holds every seat; every backup UNASSIGNED", "EXT-009; PDR-01..07"),
    ("P0", "X-07", "Close or withdraw the 15 over-evidence public statements and verify the deployed company-site revision", "founder", "docs/legal/PUBLIC_CLAIMS_APPROVAL_REGISTER.md C-01..C-15", "D33"),
    ("P0", "X-08", "Engage counsel for entity facts, public policies and institutional paper", "founder", "EXT-001..003 OPEN", "FR-001"),
    ("P0", "X-09", "Reconcile the ten register disagreements listed in the capability matrix", "product", "Docs drift", "this set"),
    ("P1", "X-10", "Enter real cash and costs; replace the $0 placeholder; set one price book", "finance", "docs/finance/13-REAL-NUMBERS-INTAKE.md", "D39, D32"),
    ("P1", "X-11", "Commission the qualified accessibility evaluation and the independent security assessment", "accessibility", "EXT-008, EXT-006 OPEN", "D40, D29"),
    ("P1", "X-12", "Run ten design-partner discovery interviews and record them", "founder", "docs/pilot/DISCOVERY-EVIDENCE-LOG.md holds no findings", "PGM-03"),
    ("P1", "X-13", "Decide Track B (target-architecture conversion): start or not, and its T0", "founder", "PDR-05", "docs/target-architecture"),
    ("P1", "X-14", "Accept or reject the 25 proposed ADRs by priority; start with 0001 to 0005", "engineering", "All Proposed; owner review due 2026-11-04", "docs/decisions"),
    ("P2", "X-15", "Sandbox tenant provisioning for partners and implementers", "engineering", "SEMESTER_SANDBOX_INSTITUTION exists for the gateway only", "D34"),
    ("P2", "X-16", "Metric dictionary and an outcome baseline protocol", "data", "EXT-015 blocked on a named customer", "D36"),
    ("P3", "X-17", "Marketplace: do nothing until D34 has three certified integrations", "founder", "ADR-0024; D-1236 gates", "D35"),
]


BACKLOG_HEAD = f"""# Semester master backlog

**As of** {ASOF} · **Base** {BASE} · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

{CEILING}

## How to read this

One backlog for the company and the product. An item is **closed only by evidence**: a passing test in the path named, and a dated file under `docs/evidence/` that a person other than the author has read. An item with only a document closes nothing (`docs/program/05-ACCEPTANCE-AND-EVIDENCE.md`). It does not duplicate the existing sequenced lists; it links to them:

| Existing list | Holds |
| --- | --- |
| [`docs/program/PHASE_1_EXECUTION_BACKLOG.md`](../program/PHASE_1_EXECUTION_BACKLOG.md) | The ten Phase 1 steps (security, tenancy, recovery, platform spine); not started |
| [`docs/finalization/EXTERNAL-EVIDENCE-QUEUE.md`](../finalization/EXTERNAL-EVIDENCE-QUEUE.md) | EXT-001 to EXT-018, items only an outside party can close; 0 of 18 closed |
| [`docs/decisions/DECISION_BACKLOG.md`](../decisions/DECISION_BACKLOG.md) | 25 proposed ADRs |
| [`docs/program/03-RAID.md`](../program/03-RAID.md) | Risks, assumptions, issues, outside dependencies, decisions awaiting an owner (PDR-01 to PDR-07) |
| [`CLAUDE-CODE-BACKLOG.md`](../CLAUDE-CODE-BACKLOG.md) | Engineering tasks queued for agents |

## Priorities

| Priority | Rule |
| --- | --- |
| P0 | Without it no claim, activation or further trust is defensible. Do before anything below |
| P1 | Needed to earn the first design-partner pilot |
| P2 | Needed once a pilot is signed |
| P3 | Deliberately deferred; the entry says what would change that |

## Rules for the backlog

1. **Evidence before breadth.** No new domain build starts while a P0 in security, recovery or tenancy is open, because every new surface multiplies the unproven isolation.
2. **Customer-led.** From P1, a domain build needs a named design partner who asked for it. The 15 domains with no customer are deferred, not cancelled.
3. **One owner, one reviewer.** A seat's holder cannot review their own item. Until X-06 closes, every review is a self-review and the item records that.
4. **No claim ahead of the row.** A public statement may not exceed the lowest of product state, evidence freshness, tenant activation and approval (`docs/PRODUCT-STATUS-MAP.md`).
5. **Smallest safe solution.** Prefer a handoff to a build; prefer a build to a platform; prefer a platform to a marketplace.
"""

def backlog():
    items = []
    for d in DS:
        for i, (p, t) in enumerate(d["nxt"], 1):
            items.append((p, f"{d['id']}-{i}", t, d["seat"], f"Test in `{d['tests'].split(';')[0].strip()}` and an evidence file under `docs/evidence/`", f"{d['id']} {d['name']}"))
    items += [(p, i, t, seat, ev, "cross-cutting") for (p, i, t, seat, ev, _ref) in CROSS]
    order = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
    items.sort(key=lambda x: (order[x[0]], x[1]))
    o = ["## Generated backlog", "", BANNER, "",
         f"Rendered from `domains.py` (each domain's `nxt` list) and the cross-cutting list in `render.py`. {len(items)} items.", ""]
    c = Counter(i[0] for i in items)
    o += ["| Priority | Items |", "| --- | ---: |"] + [f"| {p} | {c.get(p, 0)} |" for p in ["P0", "P1", "P2", "P3"]] + [""]
    for p, name in [("P0", "P0: blocks any claim, any activation, or any further trust"), ("P1", "P1: needed to earn the first design-partner pilot"),
                    ("P2", "P2: needed once a pilot is signed"), ("P3", "P3: deliberately deferred")]:
        o += [f"### {name}", "", "| ID | Item | Owner seat | Closed when | Domain |", "| --- | --- | --- | --- | --- |"]
        for it in items:
            if it[0] == p:
                o.append(f"| {it[1]} | {it[2]} | {seatname(it[3])} | {it[4]} | {it[5]} |")
        o.append("")
    return "\n".join(o), items


if __name__ == "__main__":
    w("SEMESTER_DOMAIN_CATALOG.md", catalog())
    w("SEMESTER_CAPABILITY_MATRIX.md", capability_matrix())
    w("SEMESTER_DATA_AUTHORITY_MATRIX.md", authority())
    w("SEMESTER_DOMAIN_REPLACEMENT_GATES.md", gates())
    text, items = backlog()
    w("SEMESTER_MASTER_BACKLOG.md", BACKLOG_HEAD.rstrip() + "\n\n" + text)
    print(f"rendered: {len(DS)} domains, {len(CAPS)} capabilities, {len(items)} backlog items")
