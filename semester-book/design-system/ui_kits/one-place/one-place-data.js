// "Never leave Semester": every job a user or the company does, the Semester module that does it, and what must stay external (and how it is embedded so nobody leaves).
// status: designed = rendered in this design system; build = catalogued, to build; embed = external by law or practice, surfaced inside Semester.
window.ONEPLACE = {
  audiences: ['Student', 'Faculty & staff', 'Institution', 'Company (Semester)'],
  rows: [
    // Student
    ['Student', 'Check what’s due and what to do next', 'LMS dashboard, planner app', 'Today + Action Center', 'designed', '../student/index.html'],
    ['Student', 'Calendar and schedule', 'Google / Outlook calendar', 'Calendar (two-way sync optional)', 'designed', '../student/index.html'],
    ['Student', 'Notes, docs, sheets, slides', 'Google Docs, Notion, Word', 'Write, Sheets, Decks, Notes', 'designed', '../student/index.html'],
    ['Student', 'Study cards and practice', 'Quizlet, Anki', 'Study (course-provided + yours)', 'designed', '../../templates/platform-shell/PlatformShell.dc.html'],
    ['Student', 'AI help', 'ChatGPT, other assistants', 'Ask Semester (governed, cited)', 'designed', '../student/index.html'],
    ['Student', 'Email and messages', 'School webmail, group chats', 'Mail + DMs with safety tools', 'designed', '../student/index.html'],
    ['Student', 'Plan degree and register', 'SIS portal, degree audit tool', 'Path, Plan, Registration readiness (SIS stays official)', 'designed', '../student/index.html'],
    ['Student', 'Pay a bill or set a payment plan', 'Bursar portal', 'Billing; payment runs inside an embedded processor checkout', 'embed', '../student/index.html'],
    ['Student', 'Find people, groups, events', 'Instagram, Discord, GroupMe', 'Community, groups, events', 'designed', '../community/index.html'],
    ['Student', 'Buy and sell on campus', 'Facebook Marketplace', 'Marketplace (campus-verified)', 'designed', '../community/index.html'],
    ['Student', 'Dining, housing, maps, services', 'Campus apps, GET, maps', 'Campus', 'designed', '../student/index.html'],
    ['Student', 'Get help', 'Office websites, phone trees', 'Support (routes to the owning office)', 'designed', '../student/index.html'],
    ['Student', 'Career, resume, applications', 'Handshake, LinkedIn, Word', 'Career + portfolio', 'build', '../external/index.html'],
    ['Student', 'Share with family', 'Screenshots, forwarded emails', 'Family sharing (scoped, revocable)', 'designed', '../student/index.html'],
    ['Student', 'Video office hours and study rooms', 'Zoom, Teams', 'Meet (calls inside Semester)', 'build', null],
    // Faculty & staff
    ['Faculty & staff', 'Build and run a course', 'LMS course shell', 'Course Studio (LTI to the LMS during transition)', 'build', '../staff/index.html'],
    ['Faculty & staff', 'Grade and release', 'LMS gradebook, spreadsheets', 'Gradebook, release, regrade queue', 'designed', '../staff/index.html'],
    ['Faculty & staff', 'Advising caseload and notes', 'Navigate-type CRM, spreadsheets', 'Advisor workspace', 'designed', '../staff/index.html'],
    ['Faculty & staff', 'Registrar desk', 'SIS admin screens', 'Registrar desk (writes go to SIS via approved integration)', 'designed', '../staff/index.html'],
    ['Faculty & staff', 'Student accounts', 'Bursar system', 'Student accounts desk', 'designed', '../staff/index.html'],
    ['Faculty & staff', 'Team chat and email', 'Slack, Outlook', 'Mail + team spaces', 'build', null],
    ['Faculty & staff', 'Meetings', 'Zoom, Teams', 'Meet', 'build', null],
    // Institution
    ['Institution', 'Configure tenant, roles, policies', 'Vendor admin consoles', 'Institution console', 'designed', '../console/index.html'],
    ['Institution', 'Integrations and migration', 'Vendor ETL tools', 'Integration hub + migration center', 'designed', '../console/index.html'],
    ['Institution', 'Audit, access reviews, incidents', 'Ticketing + spreadsheets', 'Security operations + audit explorer', 'designed', '../console/index.html'],
    ['Institution', 'Single sign-on', 'Institution IdP', 'Stays the institution’s IdP; Semester signs in through it', 'embed', null],
    ['Institution', 'System of record (transition)', 'SIS / LMS', 'Stays official until the institution chooses to migrate a domain', 'embed', '../workflow-runner/index.html'],
    // Company
    ['Company (Semester)', 'CRM and pipeline', 'HubSpot, Salesforce', '/ops GTM pipeline, accounts, stakeholders', 'designed', '../ops/index.html'],
    ['Company (Semester)', 'Email and calendar', 'Google Workspace', 'Mail + Calendar for operators (custom domain via mail provider)', 'embed', null],
    ['Company (Semester)', 'Docs, sheets, decks', 'Google Docs, Sheets, Slides', 'Write, Sheets, Decks (same modules as students)', 'designed', '../student/index.html'],
    ['Company (Semester)', 'Team chat', 'Slack', 'Ops inbox + team spaces', 'build', '../ops/index.html'],
    ['Company (Semester)', 'Support desk', 'Zendesk, Intercom', '/ops support desk + macros', 'designed', '../ops/index.html'],
    ['Company (Semester)', 'Status page and incidents', 'Statuspage, PagerDuty', '/ops incidents, SLOs, public status page', 'designed', '../ops/index.html'],
    ['Company (Semester)', 'Social media', 'Hootsuite, Buffer', '/ops social media control', 'designed', '../ops/index.html'],
    ['Company (Semester)', 'Marketing site and CMS', 'Webflow, WordPress', 'Company site + content register', 'designed', '../company-site/index.html'],
    ['Company (Semester)', 'Invoices and receivables', 'QuickBooks invoicing', '/ops finance: invoices, AR, dunning', 'designed', '../ops/index.html'],
    ['Company (Semester)', 'Accounting ledger and tax filing', 'QuickBooks, accountant', 'Ledger view + monthly close in /ops; filings by the accountant', 'embed', '../../docs/run/Finance%20Model.html'],
    ['Company (Semester)', 'Banking and card payments', 'Bank, Stripe', 'Must stay with a licensed bank and payment processor; balances and payouts shown in /ops', 'embed', '../ops/index.html'],
    ['Company (Semester)', 'Contracts and e-signature', 'DocuSign', 'Contracts register + in-app signing (or embedded e-sign provider)', 'build', '../../docs/legal/Master%20Services%20Agreement.html'],
    ['Company (Semester)', 'Hiring and people', 'Greenhouse, Gusto', '/ops people: hiring pipeline, onboarding; payroll runs through a payroll provider', 'embed', '../../docs/run/Hiring%20Plan.html'],
    ['Company (Semester)', 'Compliance evidence', 'Vanta, Drata, spreadsheets', '/ops trust & compliance: controls, evidence, HECVAT', 'designed', '../ops/index.html'],
    ['Company (Semester)', 'Roadmap and tickets', 'Linear, Jira', '/ops product operations: backlog, releases, feature flags', 'designed', '../ops/index.html'],
    ['Company (Semester)', 'Code and CI', 'GitHub, Vercel', 'Stays on GitHub + Vercel; release evidence and deploy status shown in /ops', 'embed', '../ops/index.html'],
    ['Company (Semester)', 'Board and investor reporting', 'Decks, email', '/ops board/investor reports + investor portal', 'designed', '../investor/index.html'],
    ['Company (Semester)', 'Company metrics', 'Spreadsheets, BI tools', '/ops executive overview + KPI dashboard', 'designed', '../ops/index.html']
  ],
  why: {
    embed: 'External by law, licence or the institution’s choice. Semester shows it, links it and runs the workflow around it so nobody switches apps; the regulated step happens in an embedded provider screen.'
  }
};
