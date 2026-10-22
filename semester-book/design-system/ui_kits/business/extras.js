window.BIZ_EXTRA = {
roadmap: [
 { span: 'Days 1–30 · Make the pilot legal to run', items: ['Bind cyber + E&O insurance (contract requirement)', 'EIN, state tax registration, business bank, bookkeeping', 'Map every DPA/FERPA obligation to a control and an owner', 'Publish subprocessor list: Vercel, Supabase (+ AI provider, with "no student records" boundary)', 'Data inventory + data-flow map for student records', 'Retention + deletion schedule', 'Test that student records never reach an AI provider; document it'] },
 { span: 'Days 31–60 · Pass the university reviews', items: ['Complete HECVAT Full from docs/trust + evidence register', 'Ship SAML / Shibboleth SSO with the university IdP', 'VPAT / ACR against WCAG 2.1 AA (use existing a11y tests as evidence)', 'Incident-response tabletop; record it', 'Restore-from-backup test; record RTO/RPO', 'Privacy Policy + Terms reviewed by counsel'] },
 { span: 'Days 61–90 · Launch and prove the pilot', items: ['Agree pilot start + renewal decision dates in a mutual action plan', 'Baseline the success metrics with the champion', 'Onboarding + support intake with severity levels', 'Weekly check-in and KPI review', 'Draft the results deck and annual conversion proposal'] },
],
risks: [
 ['Pilot starts without required insurance', 'High', 'High', 'Bind cyber + E&O in days 1–30; send certificate to the university', 'Founder'],
 ['HECVAT Full not complete → security review stalls', 'High', 'High', 'Start from docs/trust; answer only verified controls; book a review call', 'Founder'],
 ['SAML SSO not ready for launch', 'Medium', 'High', 'Prioritise SSO in days 31–60; test with the university IdP early', 'Engineering'],
 ['Student record exposure / breach', 'Low', 'Critical', 'RLS + tenant isolation tests, least privilege, IR plan, AI boundary test', 'Founder'],
 ['VPAT gaps found late', 'Medium', 'Medium', 'Run ACR early; fix blockers before launch; disclose known gaps', 'Founder'],
 ['No decision date → pilot drifts, no conversion', 'High', 'High', 'Mutual action plan with named economic buyer and decision date', 'Founder'],
 ['Solo-founder capacity', 'High', 'Medium', 'Use budget for counsel/broker/accountant; contractors with IP + NDA; defer P2', 'Founder'],
 ['Claims outrun evidence in marketing', 'Medium', 'Medium', 'Public claims register; no "secure/compliant" without evidence', 'Founder'],
],
hiring: [
 ['Now', 'Fractional counsel (DPA, MSA, privacy)', 'Contract', 'Pilot obligations'],
 ['Now', 'Insurance broker', 'Contract', 'Cyber + E&O'],
 ['Now', 'Bookkeeper / accountant', 'Contract', 'First invoice'],
 ['After pilot launch', 'Implementation / support contractor', 'Contract', 'Pilot support load > founder capacity'],
 ['After second paid customer', 'First full-time engineer', 'Hire', 'Two institutions live'],
],
fundraising: [
 ['Decide raise vs. bootstrap after pilot results', 'Deferred'], ['Convert LLC → Delaware C-corp before a priced round', 'Deferred'], ['Clean cap table + IP chain', 'Ready (IP signed)'], ['Data room: contracts, security, financials', 'Not started'], ['Investor deck from pilot results', 'Draft (this kit)'], ['12-month model with scenarios', 'Not started'],
],
};
window.BIZ_LAUNCH = [
 ['Corporate', 'Company owns all IP; founder + contractor assignments filed', 'Signed assignments in records folder'],
 ['Banking', 'Business account, approval rules, chart of accounts', 'Business funds separate from personal'],
 ['Accounting', 'Bookkeeping, monthly close checklist, expense policy, tax calendar', 'Monthly P&L, balance sheet, cash flow'],
 ['Financial model', '36-month driver-based model', 'Unit economics, runway, break-even'],
 ['Pricing', 'Pilot, institution, implementation, AI overage, support', 'Approved price book + discount rules'],
 ['Insurance', 'Cyber, E&O, general liability; evaluate D&O later', 'Coverage reviewed against contract'],
 ['Legal', 'Terms, Privacy, DPA, SLA, MSA', 'Versioned and counsel-reviewed'],
 ['Identity', 'MFA on admin, code, cloud, finance, CRM, support, production', 'MFA report'],
 ['Access', 'Least privilege, role review, contractor offboarding', 'Quarterly access review log'],
 ['Data', 'Encryption in transit/at rest, backups, restore test', 'Restore test record with RTO/RPO'],
 ['Monitoring', 'Errors, uptime, security alert triage, audit logging', 'Alert runbook + on-call'],
 ['Resilience', 'Business continuity + DR runbook, tested', 'Tabletop record'],
 ['Vendor risk', 'Subprocessor review + vendor register', 'Vendor register'],
 ['Procurement', 'HECVAT Full, answer library, DPA/SLA path', 'Completed HECVAT'],
 ['Accessibility', 'ACR/VPAT, manual test protocol, statement', 'Published ACR'],
];
