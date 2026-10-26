export type Kind = 'text' | 'long' | 'select' | 'multi' | 'money' | 'date' | 'url' | 'user' | 'link' | 'check';
export type TableKey = 'accounts' | 'deals' | 'contracts' | 'projects' | 'tickets';
export type Field = {
  key: string; label: string; kind: Kind; options?: string[]; link?: TableKey;
  required?: boolean; inTable?: boolean; hint?: string;
};

export const GATES = [
  'Scope signed off', 'Tenant configured', 'SSO validated', 'Integrations validated',
  'Security evidence reviewed', 'Accessibility evidence reviewed', 'Training complete', 'Institution acceptance',
];

export const TITLE_FIELD: Record<TableKey, string> = {
  accounts: 'legalName', deals: 'name', contracts: 'title', projects: 'name', tickets: 'subject',
};

const sample: Field = { key: 'isSample', label: 'Sample (synthetic) record', kind: 'check' };

export const TABLES: Record<TableKey, { label: string; singular: string; blurb: string; fields: Field[] }> = {
  accounts: {
    label: 'Accounts', singular: 'account', blurb: 'Institutions Semester sells to and serves.',
    fields: [
      { key: 'legalName', label: 'Legal name', kind: 'text', required: true, inTable: true },
      { key: 'segment', label: 'Segment', kind: 'select', inTable: true, options: ['Four-year public', 'Four-year private', 'Community college', 'Graduate school', 'Other'] },
      { key: 'lifecycleStage', label: 'Lifecycle', kind: 'select', inTable: true, options: ['Prospect', 'Customer', 'Churned'], hint: 'Becomes Customer automatically when a contract activates.' },
      { key: 'owner', label: 'Owner', kind: 'user', inTable: true },
      { key: 'website', label: 'Website', kind: 'url' },
      { key: 'notes', label: 'Notes', kind: 'long', hint: 'No student records here.' },
      sample,
    ],
  },
  deals: {
    label: 'Deals', singular: 'deal', blurb: 'Qualification through commercial approval to won.',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true, inTable: true },
      { key: 'account', label: 'Account', kind: 'link', link: 'accounts', inTable: true },
      { key: 'stage', label: 'Stage', kind: 'select', inTable: true, options: ['Qualification', 'Discovery', 'Proposal', 'Commercial Approval', 'Won', 'Lost'], hint: 'Won requires approval by someone other than the owner.' },
      { key: 'amountMinor', label: 'Amount (USD)', kind: 'money', inTable: true },
      { key: 'closeDate', label: 'Close date', kind: 'date', inTable: true },
      { key: 'owner', label: 'Owner', kind: 'user' },
      { key: 'nextStep', label: 'Next step', kind: 'text' },
      sample,
    ],
  },
  contracts: {
    label: 'Contracts', singular: 'contract', blurb: 'Agreements, terms and obligations.',
    fields: [
      { key: 'title', label: 'Title', kind: 'text', required: true, inTable: true },
      { key: 'account', label: 'Account', kind: 'link', link: 'accounts', inTable: true },
      { key: 'deal', label: 'Deal', kind: 'link', link: 'deals' },
      { key: 'state', label: 'State', kind: 'select', inTable: true, options: ['Draft', 'In Legal Review', 'Out for Signature', 'Active', 'Expired', 'Terminated'], hint: 'Active requires a signed document link and start date.' },
      { key: 'annualValueMinor', label: 'Annual value (USD)', kind: 'money', inTable: true },
      { key: 'startsOn', label: 'Starts on', kind: 'date', inTable: true },
      { key: 'endsOn', label: 'Ends on', kind: 'date' },
      { key: 'signedDocumentLink', label: 'Signed document link', kind: 'url' },
      { key: 'obligations', label: 'Obligations', kind: 'long' },
      sample,
    ],
  },
  projects: {
    label: 'Implementation', singular: 'project', blurb: 'Launch gates from kickoff to cohort activation.',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true, inTable: true },
      { key: 'account', label: 'Account', kind: 'link', link: 'accounts', inTable: true },
      { key: 'contract', label: 'Contract', kind: 'link', link: 'contracts' },
      { key: 'state', label: 'State', kind: 'select', inTable: true, options: ['Kickoff', 'Configuration', 'Validation', 'Accepted', 'Activated', 'On Hold'], hint: 'Activated requires all 8 gates and an Active contract.' },
      { key: 'gatesPassed', label: 'Gates passed', kind: 'multi', options: GATES, inTable: true },
      { key: 'targetLaunch', label: 'Target launch', kind: 'date', inTable: true },
      { key: 'owner', label: 'Owner', kind: 'user' },
      { key: 'gateEvidence', label: 'Gate evidence', kind: 'long', hint: 'Link or describe the evidence for each passed gate.' },
      sample,
    ],
  },
  tickets: {
    label: 'Support', singular: 'ticket', blurb: 'Customer support with severity and response clocks.',
    fields: [
      { key: 'subject', label: 'Subject', kind: 'text', required: true, inTable: true },
      { key: 'account', label: 'Account', kind: 'link', link: 'accounts', inTable: true },
      { key: 'severity', label: 'Severity', kind: 'select', inTable: true, options: ['Sev 1', 'Sev 2', 'Sev 3', 'Sev 4'] },
      { key: 'state', label: 'State', kind: 'select', inTable: true, options: ['New', 'Triaged', 'In Progress', 'Waiting on Customer', 'Resolved', 'Closed'] },
      { key: 'assignee', label: 'Assignee', kind: 'user', inTable: true },
      { key: 'openedAt', label: 'Opened', kind: 'date', inTable: true },
      { key: 'safeDescription', label: 'Description', kind: 'long', hint: 'Never paste student-record content. Use internal references only.' },
      sample,
    ],
  },
};

export const money = (minor?: number | null) =>
  minor == null ? '—' : (minor / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
