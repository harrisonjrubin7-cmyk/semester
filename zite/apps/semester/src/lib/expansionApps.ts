// S-76 stage 0: the 32 enterprise and campus applications, kept as their own expansion register (not added to the 69+7
// baseline count, because E26 Family and E29 Developer already exist there). Classification is what the repository shows
// today, not a plan: 'built' = a persistent workflow exists in Zite with tests; 'extend' = an existing app covers part of it;
// 'new' = nothing exists yet; 'blocked' = may not be designed until a named approval exists. Pure; tested in
// tests/expansion.test.ts.
export type ExpansionClass = 'built' | 'extend' | 'new' | 'blocked';
export type ExpansionRow = { id: string; name: string; stage: number; cls: ExpansionClass; reuse: string; blockedBy?: string };

export const EXPANSION_APPS: ExpansionRow[] = [
  { id: 'E01', name: 'Assessment and Accreditation', stage: 3, cls: 'extend', reuse: 'Programs (prg_*) and Curriculum (cur_*) hold outcomes; no assessment evidence or accreditation reports yet' },
  { id: 'E02', name: 'Continuing Education', stage: 3, cls: 'new', reuse: 'Catalog and Registration patterns' },
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
  { id: 'E28', name: 'Independent Learner', stage: 2, cls: 'extend', reuse: 'Personal workspace (tasks, study, grade tracker, syllabi)' },
  { id: 'E29', name: 'Developer', stage: 2, cls: 'extend', reuse: 'semester-developers app (already in the 69+7 baseline)' },
  { id: 'E30', name: 'Partner Administration', stage: 2, cls: 'new', reuse: 'Company OS roles (co_roles, founder-granted)' },
  { id: 'E31', name: 'Records and Privacy Requests', stage: 2, cls: 'built', reuse: 'Extends APP-013 recordsRights (prv_*): records routed to owners and collected, per-record release/redact/withhold (third-party records never released plainly), second office member approves the exact decisions, inspect fulfilled only with an approved response the student opens for 14 days, records holds block amendments, hearings decided by someone other than the denier. Account deletion stays in privacy.ts (a case; Semester deletes nothing)' },
  { id: 'E32', name: 'Audit and Assurance', stage: 2, cls: 'extend', reuse: 'Security Lab and Atlas evidence registers' },
];

export function expansionSummary(rows: ExpansionRow[] = EXPANSION_APPS) {
  const by = (c: ExpansionClass) => rows.filter((r) => r.cls === c).length;
  return { total: rows.length, built: by('built'), extend: by('extend'), new: by('new'), blocked: by('blocked') };
}
