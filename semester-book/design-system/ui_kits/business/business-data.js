// Canonical record for every view, document and deck. Status inferred from repo docs where evidence exists, otherwise from founder answers; "Not confirmed — verify" where neither.
window.BIZ = {
 "facts": {
  "entity": "LLC (home state)",
  "stage": "Pre-seed, no revenue, bootstrapping",
  "team": "Solo founder; contractors with signed IP assignments",
  "pilot": "Paid university pilot signed — DPA/FERPA addendum, HECVAT Full, VPAT/ACR, SAML SSO, cyber + E&O insurance required; real student records; dates not decided",
  "hosting": "Vercel + Supabase; AI never sees student records",
  "budget": "$5k–$20k setup budget"
 },
 "items": [
  {
   "id": 1,
   "area": "Formation",
   "item": "LLC formed in home state, operating agreement signed",
   "owner": "Founder",
   "priority": "P0",
   "status": "Done",
   "gate": "Before any contract",
   "evidence": "Confirmed by founder"
  },
  {
   "id": 2,
   "area": "Formation",
   "item": "EIN, state/local tax registrations",
   "owner": "Founder + accountant",
   "priority": "P0",
   "status": "Not started",
   "gate": "Before invoicing the pilot",
   "evidence": "Not confirmed — verify"
  },
  {
   "id": 3,
   "area": "Formation",
   "item": "Dedicated business bank + payments account",
   "owner": "Founder",
   "priority": "P0",
   "status": "Not started",
   "gate": "Before pilot invoice",
   "evidence": "Not confirmed — verify"
  },
  {
   "id": 4,
   "area": "Formation",
   "item": "Corporate records folder + contract repository",
   "owner": "Founder",
   "priority": "P1",
   "status": "Not started",
   "gate": "Before diligence",
   "evidence": "—"
  },
  {
   "id": 5,
   "area": "Formation",
   "item": "Cap table (single-member LLC; record any promised equity)",
   "owner": "Founder",
   "priority": "P1",
   "status": "Not started",
   "gate": "Before advisors/hires",
   "evidence": "Solo founder"
  },
  {
   "id": 6,
   "area": "Formation",
   "item": "IP assignment from founder + every contractor",
   "owner": "Founder + counsel",
   "priority": "P0",
   "status": "Done",
   "gate": "Before code ships to customer",
   "evidence": "Confirmed: contractors signed"
  },
  {
   "id": 7,
   "area": "Formation",
   "item": "Trademark / name clearance for “Semester”",
   "owner": "Counsel",
   "priority": "P1",
   "status": "Not started",
   "gate": "Before public launch",
   "evidence": "docs/BRAND-PLATFORM.md: no clearance performed"
  },
  {
   "id": 8,
   "area": "Formation",
   "item": "Decision: convert LLC → Delaware C-corp",
   "owner": "Founder + counsel",
   "priority": "P2",
   "status": "Deferred",
   "gate": "Before priced equity round",
   "evidence": "Bootstrapping — revisit at fundraising"
  },
  {
   "id": 9,
   "area": "Insurance",
   "item": "Cyber liability",
   "owner": "Founder + broker",
   "priority": "P0",
   "status": "Not started",
   "gate": "Pilot contract requires it",
   "evidence": "Required by pilot; not held"
  },
  {
   "id": 10,
   "area": "Insurance",
   "item": "Professional / E&O",
   "owner": "Founder + broker",
   "priority": "P0",
   "status": "Not started",
   "gate": "Pilot contract requires it",
   "evidence": "Required by pilot; not held"
  },
  {
   "id": 11,
   "area": "Insurance",
   "item": "General liability",
   "owner": "Founder + broker",
   "priority": "P1",
   "status": "Not started",
   "gate": "Campus presence",
   "evidence": "—"
  },
  {
   "id": 12,
   "area": "Contracts",
   "item": "Pilot agreement (signed)",
   "owner": "Founder",
   "priority": "P0",
   "status": "Done",
   "gate": "—",
   "evidence": "Paid pilot signed"
  },
  {
   "id": 13,
   "area": "Contracts",
   "item": "Data Processing Addendum / FERPA addendum",
   "owner": "Counsel",
   "priority": "P0",
   "status": "In review",
   "gate": "Before real student records",
   "evidence": "Pilot has DPA/FERPA addendum — confirm obligations mapped"
  },
  {
   "id": 14,
   "area": "Contracts",
   "item": "Master Services Agreement + SaaS terms",
   "owner": "Counsel",
   "priority": "P1",
   "status": "Draft",
   "gate": "Before annual conversion",
   "evidence": "docs/legal-drafts/ (72 files)"
  },
  {
   "id": 15,
   "area": "Contracts",
   "item": "Order form + SOW template",
   "owner": "Founder",
   "priority": "P1",
   "status": "Not started",
   "gate": "Annual proposal",
   "evidence": "—"
  },
  {
   "id": 16,
   "area": "Contracts",
   "item": "Service Level Agreement / support policy",
   "owner": "Founder",
   "priority": "P1",
   "status": "Draft",
   "gate": "Annual conversion",
   "evidence": "docs/sre/ (34 files)"
  },
  {
   "id": 17,
   "area": "Contracts",
   "item": "Mutual NDA",
   "owner": "Counsel",
   "priority": "P2",
   "status": "Not started",
   "gate": "New prospects",
   "evidence": "—"
  },
  {
   "id": 18,
   "area": "Privacy",
   "item": "Privacy Policy + Terms of Service",
   "owner": "Counsel",
   "priority": "P0",
   "status": "Draft",
   "gate": "Before student sign-in",
   "evidence": "docs/legal-drafts/"
  },
  {
   "id": 19,
   "area": "Privacy",
   "item": "Subprocessor list (Vercel, Supabase, AI provider)",
   "owner": "Founder",
   "priority": "P0",
   "status": "Not started",
   "gate": "DPA requires it",
   "evidence": "Hosting: Vercel + Supabase"
  },
  {
   "id": 20,
   "area": "Privacy",
   "item": "Data inventory + data-flow map (student records)",
   "owner": "Founder",
   "priority": "P0",
   "status": "In progress",
   "gate": "Before real data",
   "evidence": "database/DATA_CLASSIFICATION_REGISTER.md"
  },
  {
   "id": 21,
   "area": "Privacy",
   "item": "Retention + deletion schedule",
   "owner": "Founder",
   "priority": "P0",
   "status": "Not started",
   "gate": "DPA / HECVAT",
   "evidence": "—"
  },
  {
   "id": 22,
   "area": "Privacy",
   "item": "AI boundary: student records never reach an AI provider — enforce + document",
   "owner": "Founder",
   "priority": "P0",
   "status": "In progress",
   "gate": "HECVAT, DPA",
   "evidence": "Policy decided; needs a test + doc"
  },
  {
   "id": 23,
   "area": "Security",
   "item": "HECVAT Full completed",
   "owner": "Founder",
   "priority": "P0",
   "status": "Not started",
   "gate": "University security review",
   "evidence": "Required by pilot"
  },
  {
   "id": 24,
   "area": "Security",
   "item": "Security questionnaire answer library",
   "owner": "Founder",
   "priority": "P1",
   "status": "Not started",
   "gate": "HECVAT, RFPs",
   "evidence": "docs/trust/ (66 files) as source"
  },
  {
   "id": 25,
   "area": "Security",
   "item": "University SSO (SAML / Shibboleth)",
   "owner": "Engineering",
   "priority": "P0",
   "status": "Not started",
   "gate": "Pilot launch",
   "evidence": "Required by pilot"
  },
  {
   "id": 26,
   "area": "Security",
   "item": "Access-control + least-privilege policy",
   "owner": "Founder",
   "priority": "P0",
   "status": "In progress",
   "gate": "HECVAT",
   "evidence": "database/TENANT_ISOLATION_MATRIX.md, RLS"
  },
  {
   "id": 27,
   "area": "Security",
   "item": "Incident response plan + tabletop",
   "owner": "Founder",
   "priority": "P0",
   "status": "Draft",
   "gate": "HECVAT",
   "evidence": "docs/INCIDENT-RECOVERY-PLAYBOOK.md"
  },
  {
   "id": 28,
   "area": "Security",
   "item": "Backup + disaster-recovery runbook (tested)",
   "owner": "Engineering",
   "priority": "P0",
   "status": "Draft",
   "gate": "HECVAT",
   "evidence": "docs/sre/"
  },
  {
   "id": 29,
   "area": "Security",
   "item": "Vulnerability management + dependency scanning",
   "owner": "Engineering",
   "priority": "P1",
   "status": "In progress",
   "gate": "HECVAT",
   "evidence": "codeql.yml, supply-chain.yml, hawkscan.yml"
  },
  {
   "id": 30,
   "area": "Security",
   "item": "Logging + monitoring policy",
   "owner": "Engineering",
   "priority": "P1",
   "status": "In progress",
   "gate": "HECVAT",
   "evidence": "production-smoke.yml"
  },
  {
   "id": 31,
   "area": "Security",
   "item": "Evidence register mapped to controls",
   "owner": "Founder",
   "priority": "P1",
   "status": "In progress",
   "gate": "HECVAT",
   "evidence": "EVIDENCE-REGISTER.md"
  },
  {
   "id": 32,
   "area": "Security",
   "item": "Penetration-test plan",
   "owner": "Founder",
   "priority": "P2",
   "status": "Not started",
   "gate": "After first renewal",
   "evidence": "—"
  },
  {
   "id": 33,
   "area": "Security",
   "item": "Trust Center page (verified controls only)",
   "owner": "Founder",
   "priority": "P1",
   "status": "Not started",
   "gate": "Procurement",
   "evidence": "docs/trust/"
  },
  {
   "id": 34,
   "area": "Accessibility",
   "item": "VPAT / ACR (WCAG 2.1 AA)",
   "owner": "Founder",
   "priority": "P0",
   "status": "Not started",
   "gate": "Pilot contract requires it",
   "evidence": "a11y tests exist; no ACR"
  },
  {
   "id": 35,
   "area": "Accessibility",
   "item": "Accessibility statement + feedback route",
   "owner": "Founder",
   "priority": "P1",
   "status": "Not started",
   "gate": "Public launch",
   "evidence": "—"
  },
  {
   "id": 36,
   "area": "Finance",
   "item": "Bookkeeping + accounting system",
   "owner": "Founder + accountant",
   "priority": "P0",
   "status": "Not started",
   "gate": "Before pilot invoice",
   "evidence": "—"
  },
  {
   "id": 37,
   "area": "Finance",
   "item": "Pilot invoice + revenue recognition",
   "owner": "Founder",
   "priority": "P0",
   "status": "Not started",
   "gate": "Pilot start",
   "evidence": "Paid pilot"
  },
  {
   "id": 38,
   "area": "Finance",
   "item": "12-month model: burn, runway, scenarios",
   "owner": "Founder",
   "priority": "P1",
   "status": "Not started",
   "gate": "Bootstrapped planning",
   "evidence": "Budget $5k–$20k for setup"
  },
  {
   "id": 39,
   "area": "Finance",
   "item": "Unit costs: infra + AI cost per active user",
   "owner": "Founder",
   "priority": "P1",
   "status": "Not started",
   "gate": "Pricing",
   "evidence": "—"
  },
  {
   "id": 40,
   "area": "Finance",
   "item": "Pricing memo: pilot → department → institution",
   "owner": "Founder",
   "priority": "P1",
   "status": "Draft",
   "gate": "Annual proposal",
   "evidence": "PUBLIC-CLAIMS register: prices “planned”"
  },
  {
   "id": 41,
   "area": "Sales",
   "item": "Ideal customer profile + tier-1 account list",
   "owner": "Founder",
   "priority": "P1",
   "status": "Not started",
   "gate": "Second pilot",
   "evidence": "—"
  },
  {
   "id": 42,
   "area": "Sales",
   "item": "Discovery + demo scripts by persona",
   "owner": "Founder",
   "priority": "P1",
   "status": "Not started",
   "gate": "Second pilot",
   "evidence": "—"
  },
  {
   "id": 43,
   "area": "Sales",
   "item": "Pilot success plan + baseline metrics",
   "owner": "Founder + champion",
   "priority": "P0",
   "status": "Not started",
   "gate": "Pilot start",
   "evidence": "Pilot dates not decided"
  },
  {
   "id": 44,
   "area": "Sales",
   "item": "Mutual action plan with named decision date",
   "owner": "Founder + champion",
   "priority": "P0",
   "status": "Not started",
   "gate": "Pilot start",
   "evidence": "Renewal date not decided"
  },
  {
   "id": 45,
   "area": "Sales",
   "item": "Results deck + annual conversion proposal",
   "owner": "Founder",
   "priority": "P1",
   "status": "Not started",
   "gate": "Before renewal decision",
   "evidence": "—"
  },
  {
   "id": 46,
   "area": "Sales",
   "item": "Security/procurement response kit",
   "owner": "Founder",
   "priority": "P1",
   "status": "Not started",
   "gate": "Second pilot",
   "evidence": "—"
  },
  {
   "id": 47,
   "area": "Customer success",
   "item": "Onboarding plan for pilot users",
   "owner": "Founder",
   "priority": "P0",
   "status": "Not started",
   "gate": "Pilot start",
   "evidence": "—"
  },
  {
   "id": 48,
   "area": "Customer success",
   "item": "Support intake, severity levels, response times",
   "owner": "Founder",
   "priority": "P0",
   "status": "Not started",
   "gate": "Pilot start",
   "evidence": "—"
  },
  {
   "id": 49,
   "area": "Customer success",
   "item": "Weekly pilot check-in + KPI review",
   "owner": "Founder",
   "priority": "P0",
   "status": "Not started",
   "gate": "Pilot start",
   "evidence": "—"
  },
  {
   "id": 50,
   "area": "Customer success",
   "item": "QBR / renewal process",
   "owner": "Founder",
   "priority": "P1",
   "status": "Not started",
   "gate": "Mid-pilot",
   "evidence": "—"
  },
  {
   "id": 51,
   "area": "Operations",
   "item": "Weekly operating cadence + decision log",
   "owner": "Founder",
   "priority": "P1",
   "status": "In progress",
   "gate": "Ongoing",
   "evidence": "DECISIONS.md, docs/decisions/"
  },
  {
   "id": 52,
   "area": "Operations",
   "item": "Risk register (owner, mitigation, review)",
   "owner": "Founder",
   "priority": "P1",
   "status": "In progress",
   "gate": "Ongoing",
   "evidence": "LAUNCH-RISK-REGISTER.md"
  },
  {
   "id": 53,
   "area": "Operations",
   "item": "Public claims approval register",
   "owner": "Founder",
   "priority": "P1",
   "status": "In progress",
   "gate": "Any marketing",
   "evidence": "PUBLIC-CLAIMS-APPROVAL-REGISTER.md"
  },
  {
   "id": 54,
   "area": "Hiring",
   "item": "Contractor onboarding/offboarding (access, IP, NDA)",
   "owner": "Founder",
   "priority": "P1",
   "status": "Not started",
   "gate": "Next contractor",
   "evidence": "IP assignments in place"
  },
  {
   "id": 55,
   "area": "Hiring",
   "item": "First hire profile + trigger",
   "owner": "Founder",
   "priority": "P2",
   "status": "Not started",
   "gate": "Second paid customer",
   "evidence": "Solo founder"
  },
  {
   "id": 56,
   "area": "Fundraising",
   "item": "Fundraising readiness checklist",
   "owner": "Founder",
   "priority": "P2",
   "status": "Deferred",
   "gate": "When raising",
   "evidence": "Bootstrapping for now"
  }
 ]
};
