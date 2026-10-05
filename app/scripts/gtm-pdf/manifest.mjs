/**
 * What goes in each report.
 *
 * A part is hand-written text, a whole file, or an extract: a named heading
 * with its subsections, taken from a source document under docs/business.
 * Extracting keeps a PDF in step with the documents, and the generator fails
 * if a heading it names has been renamed, so a stale manifest cannot quietly
 * drop a section.
 *
 * `forbid` is a structural guard for customer-safe reports: if any pattern
 * matches the assembled text, the build stops.
 */

const B = 'docs/business';
const x = (file, ...headings) => headings.map((heading) => ({ type: 'extract', file: `${B}/${file}`, heading }));
const md = (text) => ({ type: 'md', text });

const DISCLAIMER =
  'Operating document. It is not legal, tax, accounting, insurance, privacy, security or accessibility advice. Every figure is a planning assumption or forecast, not an approved price, budget or target.';

const FULL = [
  { title: 'Executive summary', parts: [{ type: 'file', file: `${B}/reports/EXECUTIVE_SUMMARY.md` }] },
  { title: 'Semester launch wedge', parts: x('gtm/SEMESTER_MASTER_GTM_PLAYBOOK.md', 'A.0', 'A.2', 'A.7') },
  { title: 'ICP and buyer map', parts: x('gtm/SEMESTER_MASTER_GTM_PLAYBOOK.md', 'B.1', 'B.3', 'B.4') },
  {
    title: 'Pricing and packaging assumptions',
    parts: [md('Planning assumptions only. No price is approved (claim CLM-015). Four student prices and several pilot lengths conflict across the repository; the tables below name each.'), ...x('finance/PRICING_AND_PACKAGING.md', '1. Planning assumptions', '3. Conflict tables', '4. Pricing calculations')],
  },
  { title: 'Customer acquisition funnel', parts: [...x('sales/CRM_PIPELINE_DEFINITION.md', '1. Funnel-to-code crosswalk'), ...x('finance/FINANCIAL_MODEL_SPEC.md', 'Model shape')] },
  { title: 'Sales process', parts: [...x('gtm/SEMESTER_MASTER_GTM_PLAYBOOK.md', 'D.12', 'D.13', 'D.14', 'D.15', 'D.16'), ...x('sales/CRM_PIPELINE_DEFINITION.md', '7. The pilot-complete rule')] },
  { title: 'Pilot proposal framework', parts: x('sales/PILOT_PROPOSAL_TEMPLATE.md', 'Gate', '3. Proposed workflow', '5. Scope', '10. Success metrics', '11. Cadence', '13. Pricing', '14. Non-guarantee') },
  { title: 'Institutional pilot agreement outline', parts: x('templates/PILOT_AGREEMENT_BUSINESS_OUTLINE.md', 'Conflicts counsel should know about', 'Section-by-section outline', 'Counsel issue summary') },
  { title: 'Sales email sequence summary', parts: x('sales/PILOT_SALES_EMAIL_SEQUENCES.md', 'Gate', '1.1 Account-based', '2. Cadence overview') },
  { title: 'Financial model methodology', parts: x('finance/FINANCIAL_MODEL_SPEC.md', 'Where it lives', 'Inputs', 'Warnings', 'Exports', 'What is not modelled') },
  { title: 'Scenario summary', parts: x('finance/UNIT_ECONOMICS.md', 'Scenario table', 'What the numbers say') },
  {
    title: 'CAC, LTV, payback, runway and break-even definitions',
    parts: [...x('gtm/SEMESTER_MASTER_GTM_PLAYBOOK.md', 'H.2'), ...x('finance/FINANCIAL_MODEL_SPEC.md', 'Formulas'), ...x('finance/UNIT_ECONOMICS.md', 'One institution at Base prices', 'Results at Base', 'LTV sensitivity')],
  },
  { title: 'Customer success and onboarding lifecycle', parts: [...x('customer-success/ONBOARDING_WORKFLOW.md', '1.2 Timing', '2. Phase table', '5. Customer RACI', '6. Sales-to-CS handoff', '9. Support workflow'), ...x('gtm/SEMESTER_MASTER_GTM_PLAYBOOK.md', 'G.2')] },
  { title: 'Cloud security and compliance plan', parts: [...x('compliance/CLOUD_SECURITY_PLAN.md', 'Gate', '2. Governance', '3. Domains B-F', '4. Security metrics', '5. Executive escalation', '7. Launch gate'), ...x('compliance/COMPLIANCE_EVIDENCE_REGISTER.md', 'P0 gaps blocking')] },
  { title: 'Trust Center and HECVAT roadmap', parts: [...x('compliance/HECVAT_ROADMAP.md', '2. Phases', '4. Known cases'), ...x('compliance/TRUST_CENTER_INVENTORY.md', '1. Inventory', '4. Gaps')] },
  { title: '90-day plan', parts: x('gtm/SEMESTER_90_DAY_GTM_PLAN.md', 'P0 list', 'Days 1-30', 'Days 31-60', 'Days 61-90', 'Weekly activity targets') },
  { title: 'KPI tree', parts: x('gtm/SEMESTER_GTM_KPI_TREE.md', 'Rules that apply', 'The tree') },
  { title: 'Operating cadence', parts: x('gtm/SEMESTER_GTM_KPI_TREE.md', 'Meeting cadence') },
  { title: 'Risk register', parts: x('templates/RISK_REGISTER.md', 'Register') },
  { title: 'Required human and professional reviews', parts: [md('Every document in this report ends with the reviews it needs. They are collected here by document. No review has been done and no reviewer is named: counsel, accountant, tax adviser, broker, security assessor and accessibility assessor are all unassigned.'), { type: 'reviews' }] },
  { title: 'Appendix: master GTM prompt', parts: [{ type: 'file', file: `${B}/reports/MASTER_GTM_PROMPT.md` }] },
];

const CUSTOMER = 'docs/business/gtm/SEMESTER_MASTER_GTM_PLAYBOOK_CUSTOMER_SAFE.md';
const cs = (...h) => h.map((heading) => ({ type: 'extract', file: CUSTOMER, heading }));

export const REPORTS = [
  {
    id: 'full',
    out: 'Semester_GTM_Financial_Sales_Compliance_Playbook',
    title: 'Semester GTM, Financial, Sales and Compliance Playbook',
    subtitle: 'Go-to-market, financial model, institutional outreach, and cloud security and compliance plan',
    audience: 'Internal. Draft. Not for customers or investors.',
    disclaimer: DISCLAIMER,
    numbered: true,
    sections: FULL,
  },
  {
    id: 'executive',
    out: 'Semester_GTM_Executive_Summary',
    title: 'Semester GTM: Executive Summary',
    subtitle: 'A concise version of the full playbook',
    audience: 'Internal. Draft.',
    disclaimer: DISCLAIMER,
    sections: [{ title: null, parts: [{ type: 'file', file: `${B}/reports/EXECUTIVE_SUMMARY.md`, dropTitle: true }] }],
  },
  {
    id: 'board',
    out: 'Semester_GTM_Board_Investor_Summary',
    title: 'Semester: Board and Investor Summary',
    subtitle: 'Forecasts on planning assumptions',
    audience: 'Internal draft for advisers and a prospective board. Not an offer of securities.',
    disclaimer: DISCLAIMER,
    sections: [{ title: null, parts: [{ type: 'file', file: `${B}/reports/BOARD_INVESTOR_SUMMARY.md`, dropTitle: true }] }],
  },
  {
    id: 'pilot-pack',
    out: 'Semester_GTM_Pilot_Procurement_Pack',
    title: 'Semester: Registration Readiness Pilot, Procurement Pack',
    subtitle: 'Customer-safe draft for discovery, scoping and evidence exchange',
    audience: 'Customer-safe DRAFT. Not approved for external distribution: the approval record in section 1 is blank. The [VERIFIED: ...] evidence pointers and the final approver annex are for the approver and are replaced or removed before distribution.',
    disclaimer: 'A business description for discovery and scoping. It is not an offer, a contract term, or legal, security, privacy or accessibility advice. Nothing here commits Semester to launch, price or deliver.',
    numbered: true,
    customerSafe: true,
    forbid: [/\[INTERNAL/i, /user'?s brief/i, /DECISION OPEN|\bGAP\b|\bHOLD\b/, /\$\s?(18|30,000|8\.99|69|35,000|150,000|15,000)\b/, /\bARR\b/, /\bCAC\b/, /\bLTV\b/, /runway/i],
    sections: [
      { title: 'Approval record and status', parts: cs('Approval record') },
      { title: 'What Semester is', parts: cs('1. What Semester is', '2. How Semester relates') },
      { title: 'The proposed pilot concept', parts: [...cs('3. The proposed pilot concept'), ...x('sales/PILOT_PROPOSAL_TEMPLATE.md', '3. Proposed workflow', '11. Cadence')] },
      { title: 'What an engagement can include today', parts: cs('4. What an engagement can include today') },
      { title: 'Student experience principles', parts: cs('5. Student experience principles') },
      { title: 'Security, privacy, accessibility and AI: process, not certification', parts: cs('6. Security, privacy') },
      { title: 'Current limitations', parts: cs('7. Current limitations') },
      { title: 'Pricing and terms', parts: [...x('sales/PILOT_PROPOSAL_TEMPLATE.md', '13. Pricing', '14. Non-guarantee')] },
      { title: 'Mutual Action Plan', parts: x('sales/MUTUAL_ACTION_PLAN_TEMPLATE.md', 'The plan') },
      { title: 'Roadmap and next step', parts: cs('8. Roadmap', '9. Next step') },
      { title: 'Approver annex (remove before distribution)', parts: cs('Statement register', 'Prohibited claims') },
    ],
  },
];
