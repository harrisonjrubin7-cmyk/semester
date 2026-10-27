// S-76 stage 0: the 32 enterprise and campus applications, kept as their own expansion register (not added to the 69+7
// baseline count, because E26 Family and E29 Developer already exist there). Classification is what the repository shows
// today, not a plan: 'built' = a persistent workflow exists in Zite with tests; 'extend' = an existing app covers part of it;
// 'new' = nothing exists yet; 'blocked' = may not be designed until a named approval exists. Pure; tested in
// tests/expansion.test.ts.
export type ExpansionClass = 'built' | 'extend' | 'new' | 'blocked';
export type ExpansionRow = { id: string; name: string; stage: number; cls: ExpansionClass; reuse: string; blockedBy?: string };

export const EXPANSION_APPS: ExpansionRow[] = [
  { id: 'E01', name: 'Assessment and Accreditation', stage: 3, cls: 'extend', reuse: 'Programs (prg_*) and Curriculum (cur_*) hold outcomes; no assessment evidence or accreditation reports yet' },
  { id: 'E02', name: 'Continuing Education', stage: 3, cls: 'built', reuse: 'Learn → Continuing education (cne_*): coordinators publish offerings with sessions, seats, prerequisites (met by credentials) and an attendance threshold; anyone signed in enrolls in public offerings (independent learners too); finance records payment, sponsorship and refunds with external references (no money moves), the authority waives fees, decides completion and issues or revokes credentials. Enrollment, payment, completion and refund are separate columns kept consistent by table CHECKs; schedule changes and cancellations notify learners in-app' },
  { id: 'E03', name: 'Professional and Clinical Education', stage: 3, cls: 'blocked', reuse: 'none', blockedBy: 'Educational-placement boundaries approved by the owner' },
  { id: 'E04', name: 'Instructional Design', stage: 3, cls: 'new', reuse: 'Faculty app course sections' },
  { id: 'E05', name: 'Human Resources', stage: 5, cls: 'new', reuse: 'Institution memberships' },
  { id: 'E06', name: 'Recruiting and Appointments', stage: 5, cls: 'new', reuse: 'Employers app requisition pattern (separate tenant boundary)' },
  { id: 'E07', name: 'Payroll and Time', stage: 5, cls: 'blocked', reuse: 'none', blockedBy: 'Money movement stays disabled; pay rules and provider contract needed' },
  { id: 'E08', name: 'Procurement', stage: 4, cls: 'new', reuse: 'none' },
  { id: 'E09', name: 'Supplier Portal', stage: 4, cls: 'new', reuse: 'Employers organization verification pattern' },
  { id: 'E10', name: 'Institutional Finance', stage: 4, cls: 'blocked', reuse: 'none', blockedBy: 'Money movement stays disabled; ledger ownership decision needed' },
  { id: 'E11', name: 'Budget and Planning', stage: 4, cls: 'new', reuse: 'none' },
  { id: 'E12', name: 'Contracts', stage: 4, cls: 'new', reuse: 'Hash-pinned acceptance (housing contracts)' },
  { id: 'E13', name: 'Facilities', stage: 6, cls: 'built', reuse: 'Campus → Facilities (fac_*): reports with minimum-necessary status, duplicates, authorized and assigned work orders, completion evidence, independent inspection, restricted locations, expiring contractor access, planned maintenance. Residence halls stay in Housing (hsg_maint); parts are not yet linked to Inventory' },
  { id: 'E14', name: 'Assets and Inventory', stage: 6, cls: 'built', reuse: 'Campus → Inventory (ast_*): tagged assets with custody and inspection history, independent disposal approval, stock that never goes negative, reservations, issues, returns, counts with independent adjustment approval' },
  { id: 'E15', name: 'IT Service Management', stage: 6, cls: 'built', reuse: 'Campus → IT help (its_*): tickets, incidents, restricted security incidents, owner-approved changes' },
  { id: 'E16', name: 'Campus Identity and Card', stage: 6, cls: 'built', reuse: 'Campus → ID card (idc_*): cards with office references only, door-access requests, security approval for restricted zones, nothing active or revoked until a controller confirmation is recorded, lost-card revocation and replacement. No controller integration (records only); dining entitlements stay in Dining' },
  { id: 'E17', name: 'Transportation and Parking', stage: 6, cls: 'built', reuse: 'Campus → Parking (prk_*): vehicles, zones, permits with capacity and waitlist, citations, independent appeals; no payments, no location tracking; trips and schedules not built' },
  { id: 'E18', name: 'Library', stage: 6, cls: 'built', reuse: 'Campus → Library (lby_*): catalog, loans, holds, renewals, desk returns, licence-reviewed resource requests; no reading history kept; no fines' },
  { id: 'E19', name: 'Campus Safety', stage: 8, cls: 'blocked', reuse: 'none', blockedBy: 'Specialist operational authorization; Semester is not emergency dispatch' },
  { id: 'E20', name: 'Emergency Communications', stage: 8, cls: 'blocked', reuse: 'none', blockedBy: 'Specialist operational authorization; external sending stays disabled' },
  { id: 'E21', name: 'Health Services', stage: 99, cls: 'blocked', reuse: 'none', blockedBy: 'Separately approved clinical boundaries — no design of any kind until recorded' },
  { id: 'E22', name: 'Advancement and Giving', stage: 7, cls: 'blocked', reuse: 'none', blockedBy: 'Money movement stays disabled; gift acceptance policy needed' },
  { id: 'E23', name: 'Research Administration', stage: 7, cls: 'new', reuse: 'none' },
  { id: 'E24', name: 'Grants and Sponsored Projects', stage: 7, cls: 'new', reuse: 'Scholarship sponsor verification pattern' },
  { id: 'E25', name: 'Research Ethics and Protocol Review', stage: 7, cls: 'new', reuse: 'Curriculum committee review pattern' },
  { id: 'E26', name: 'Family and Delegated Access', stage: 2, cls: 'extend', reuse: 'semester-family app (already in the 69+7 baseline); access log not built' },
  { id: 'E27', name: 'Authorized Payer', stage: 4, cls: 'blocked', reuse: 'semester-family grants', blockedBy: 'Money movement stays disabled; a delegate is never automatically a payer' },
  { id: 'E28', name: 'Independent Learner', stage: 2, cls: 'built', reuse: 'Extends the personal workspace: You → Workspaces lets the same account request to join an institution by invite code (Pending until its administrator approves; never Administrator), list its workspaces and switch. The server picks one current membership per request (stored choice if still active, else institution over personal/sample) — this also fixes admissions creating a second active membership that was picked at random. Nothing moves between tenants. Offerings/purchases for independent learners stay with Marketplace (payments disabled)' },
  { id: 'E29', name: 'Developer', stage: 2, cls: 'extend', reuse: 'semester-developers app (already in the 69+7 baseline)' },
  { id: 'E30', name: 'Partner Administration', stage: 2, cls: 'built', reuse: 'You → Partner organizations (pta_*): outside organizations register and manage their own members (delegated-admin limits), apply per institution; partner managers verify, a different manager proposes hash-pinned terms with an end date and the exact scopes, an org admin accepts; suspend, reinstate, offboard (records kept); pta_live() is the access check for other modules. Not yet wired into Marketplace/Research/Transfer screens' },
  { id: 'E31', name: 'Records and Privacy Requests', stage: 2, cls: 'built', reuse: 'Extends APP-013 recordsRights (prv_*): records routed to owners and collected, per-record release/redact/withhold (third-party records never released plainly), second office member approves the exact decisions, inspect fulfilled only with an approved response the student opens for 14 days, records holds block amendments, hearings decided by someone other than the denier. Account deletion stays in privacy.ts (a case; Semester deletes nothing)' },
  { id: 'E32', name: 'Audit and Assurance', stage: 2, cls: 'built', reuse: 'Campus → Audit (aud_*): administrator grants one person a purpose, named areas and at most 180 days (no read-all role; revocation applies on the next request); controls, plans, evidence as reference + SHA-256 (append-only, re-hash compare logs tamper suspicion), tests citing only their plan\'s evidence, findings answered and remediated by the management owner and closed only by an independent auditor citing post-remediation evidence. Security Lab writes now need the security_lead company role; synthetic testing stays there' },
];

export function expansionSummary(rows: ExpansionRow[] = EXPANSION_APPS) {
  const by = (c: ExpansionClass) => rows.filter((r) => r.cls === c).length;
  return { total: rows.length, built: by('built'), extend: by('extend'), new: by('new'), blocked: by('blocked') };
}
