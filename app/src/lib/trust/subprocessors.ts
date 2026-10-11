/**
 * Every third party a student's data can reach, and on whose decision.
 *
 * `docs/market-readiness/PROCUREMENT_CHECKLIST.md` recorded the subprocessor
 * list as "No — constructible from this tree". This is it constructed, and
 * `subprocessors.test.ts` keeps it constructed: it reads the content-security
 * policy in `app/index.html` — the browser's own list of every host the app
 * may send anything to — and fails if a host there is missing here, or a host
 * here is no longer there. It does the same for every Supabase Edge Function,
 * which is where server-side calls to third parties are made.
 *
 * ## Three kinds, and the difference is the point
 *
 * A procurement reviewer asks "who are your subprocessors", and the honest
 * answer splits three ways, because the legal relationship differs:
 *
 *   - **subprocessor** — processes data *on Semester's behalf*, under
 *     Semester's account and key. A DPA names these.
 *   - **institution-directed** — reached only once an institution configures
 *     it (its LMS, its approved AI provider). The institution chose it; Semester
 *     operates the connection.
 *   - **student-directed** — the student's own account at a service the student
 *     chose to connect, called from their own browser or relayed at their
 *     request. Semester holds no contract with it and it is not Semester's
 *     subprocessor; the privacy screen says what goes where before it happens.
 *
 * Folding the third kind into the first would overstate what Semester controls;
 * leaving it out would understate where data goes. Both are listed.
 */

export type Kind = 'subprocessor' | 'institution-directed' | 'student-directed';
export type When = 'always' | 'signed-in' | 'institution-enabled' | 'student-opt-in' | 'form-sent' | 'form-sent-or-opted-in-support-reply';

export interface Party {
  name: string;
  kind: Kind;
  purpose: string;
  /** What reaches it, in words a privacy officer would use. */
  receives: string;
  when: When;
  /** Hosts as the content-security policy names them. Empty for server-only. */
  hosts: string[];
  /** Supabase Edge Functions that call it. */
  functions?: string[];
  /** Files that show the relationship. */
  evidence: string[];
}

export const PARTIES: readonly Party[] = [
  // ── Semester's subprocessors ─────────────────────────────────────────────
  {
    name: 'Supabase', kind: 'subprocessor',
    purpose: 'Database, authentication, storage of synced rows, and Edge Functions.',
    receives: 'Account email and sign-in records; what a signed-in student chose to sync; usage counts; audit records.',
    when: 'signed-in', hosts: ['*.supabase.co'],
    functions: ['calendar', 'trust-room', 'integration-tick', 'ops-projector', 'delete-account'],
    evidence: ['supabase/config.toml', 'app/src/lib/cloud.ts', 'RETENTION.md'],
  },
  {
    name: 'GitHub Pages', kind: 'subprocessor',
    purpose: 'Serves the public web app’s static files.',
    receives: 'Standard request metadata (IP address, user agent) when the app is loaded. No student content.',
    when: 'always', hosts: [],
    evidence: ['.github/workflows/pages.yml'],
  },
  {
    name: 'Vercel', kind: 'subprocessor',
    purpose: 'Runs the institutional gateway as serverless functions.',
    receives: 'Institution-scoped requests from signed-in members of a connected institution. Action bodies are encrypted before they are stored.',
    when: 'institution-enabled', hosts: [],
    evidence: ['app/vercel.json', 'app/api/institution/[...path].ts'],
  },
  {
    name: 'Anthropic (Semester’s key)', kind: 'subprocessor',
    purpose: 'AI features for signed-in students who have not supplied their own key, metered per account. When the owner sets AI_GATEWAY_API_KEY the request reaches Anthropic through Vercel AI Gateway.',
    receives: 'The text of the AI request the student made (for example a syllabus to turn into a course).',
    when: 'signed-in', hosts: [], functions: ['claude'],
    evidence: ['supabase/functions/claude/index.ts', 'supabase/functions/_shared/upstream.ts', 'app/src/lib/privacy.ts'],
  },
  {
    name: 'Stripe', kind: 'subprocessor',
    purpose: 'Payments for a paid plan: the hosted checkout page, recurring billing, and the webhook that tells Semester a payment succeeded or failed. Not active until its keys are set; nothing is charged before then.',
    receives: 'The student’s email address, the plan and price chosen, and the payment details they type into Stripe’s own page, which never pass through Semester. Semester keeps Stripe’s customer and subscription references, never card or bank data.',
    when: 'student-opt-in', hosts: [], functions: ['billing-cancel', 'billing-checkout', 'billing-portal', 'billing-webhook'],
    evidence: ['supabase/functions/billing-cancel/index.ts', 'supabase/functions/billing-checkout/index.ts', 'supabase/functions/billing-portal/index.ts', 'supabase/functions/billing-webhook/index.ts', 'docs/COMMERCIAL-CORE.md'],
  },
  {
    name: 'Resend', kind: 'subprocessor',
    purpose: 'Emails each company-site form submission to the Semester owner. The built support-notice path can send a generic hint after student opt-in, but remains inactive until vendor review, executed terms/DPA, ownership and activation approval are recorded in addition to its key and sender.',
    receives: 'For site forms: the visitor’s submitted contact fields and reference. For opted-in support notices: the student’s email address, a support reference and app link, but never the reply body or approved diagnostic context. No IP address.',
    when: 'form-sent-or-opted-in-support-reply', hosts: [], functions: ['lead-intake', 'support-reply-notify'],
    evidence: ['supabase/functions/lead-intake/index.ts', 'supabase/functions/support-reply-notify/index.ts', 'docs/COMMERCIAL-CORE.md'],
  },
  // ── Institution-directed ─────────────────────────────────────────────────
  {
    name: 'OpenAI (institution-approved)', kind: 'institution-directed',
    purpose: 'AI over approved course sources, through the gateway, once an institution approves the provider and a budget.',
    receives: 'The student’s request and the approved sources it cites; never data classified above what the institution’s rules allow to that destination.',
    when: 'institution-enabled', hosts: [],
    evidence: ['app/server/institution/providers/openai.ts', 'docs/market-readiness/AI_GOVERNANCE.md'],
  },
  {
    name: 'The institution’s LMS (LTI 1.3 platform)', kind: 'institution-directed',
    purpose: 'Course launch, deep linking and, where an instructor placed a graded link, a quiz score.',
    receives: 'Launch verification traffic; a score only for a graded link the instructor placed.',
    when: 'institution-enabled', hosts: [], functions: ['lti'],
    evidence: ['supabase/functions/lti/index.ts', 'supabase/lti.check.sql'],
  },
  // ── Student-directed ─────────────────────────────────────────────────────
  {
    name: 'Anthropic (student’s own key)', kind: 'student-directed',
    purpose: 'AI features using a key the student entered on their device.',
    receives: 'The student’s AI request, sent from their browser under their own key.',
    when: 'student-opt-in', hosts: ['api.anthropic.com'],
    evidence: ['app/src/lib/claude.ts', 'app/src/lib/privacy.ts'],
  },
  {
    name: 'OpenAI (student’s own key)', kind: 'student-directed',
    purpose: 'AI features using a key the student entered on their device.',
    receives: 'The student’s AI request, sent from their browser under their own key.',
    when: 'student-opt-in', hosts: ['api.openai.com'],
    evidence: ['app/src/lib/openai.ts'],
  },
  {
    name: 'Microsoft', kind: 'student-directed',
    purpose: 'Signing in with Microsoft, and connecting the student’s own Outlook calendar and mail, OneDrive and Microsoft To Do.',
    receives: 'Reads: whatever the student’s own Microsoft account returns to their browser, under the permission they granted. Writes, only when the student asks: a file saved to OneDrive (its name and contents), a calendar event (title, time and note) and a Microsoft To Do item (title and note).',
    when: 'student-opt-in', hosts: ['login.microsoftonline.com', 'graph.microsoft.com'],
    evidence: ['app/src/lib/connect.ts'],
  },
  {
    name: 'Google', kind: 'student-directed',
    purpose: 'Signing in with Google, and connecting the student’s own Google Calendar, Gmail, Google Drive and Google Tasks.',
    receives: 'Reads: whatever the student’s own Google account returns to their browser, under the permission they granted. Writes, only when the student asks: a file saved to Google Drive (its name and contents), a calendar event (title, time and note) and a Google Tasks item (title and note).',
    when: 'student-opt-in',
    hosts: ['accounts.google.com', 'oauth2.googleapis.com', 'www.googleapis.com', 'gmail.googleapis.com', 'tasks.googleapis.com'],
    evidence: ['app/src/lib/connect.ts'],
  },
  {
    name: 'Zoom', kind: 'student-directed',
    purpose: 'Connecting the student’s own Zoom meetings.',
    receives: 'The student’s own meeting list, read in their browser.',
    when: 'student-opt-in', hosts: ['zoom.us', 'api.zoom.us'],
    evidence: ['app/src/lib/connect.ts'],
  },
  {
    name: 'Apple', kind: 'student-directed',
    purpose: 'Signing in with Apple.',
    receives: 'The sign-in exchange the student starts.',
    when: 'student-opt-in', hosts: ['appleid.apple.com'],
    evidence: ['app/src/lib/connect.ts'],
  },
  {
    name: 'OpenStreetMap tile servers', kind: 'student-directed',
    purpose: 'Map images when the student opens the map.',
    receives: 'The student’s IP address and which map area is being viewed.',
    when: 'student-opt-in', hosts: ['*.tile.openstreetmap.org'],
    evidence: ['app/src/lib/findplace.ts', 'app/src/lib/privacy.ts'],
  },
  {
    name: 'Nominatim and Photon (address lookup)', kind: 'student-directed',
    purpose: 'Turning a typed address into a map position, and only if the student switched lookup on.',
    receives: 'The text the student typed into the lookup box; their position only if they separately switched reverse lookup on.',
    when: 'student-opt-in', hosts: ['nominatim.openstreetmap.org', 'photon.komoot.io'],
    evidence: ['app/src/lib/geocode.ts'],
  },
  {
    name: 'Public institution source hosts', kind: 'student-directed',
    purpose: 'Checking the availability of a public source and whether it contains a reviewed exact excerpt.',
    receives: 'A request to the public source URL chosen by the student. No Semester session token, reflections, or excerpt is sent to the source host.',
    when: 'student-opt-in', hosts: [], functions: ['productivity-sourcecheck'],
    evidence: ['supabase/functions/productivity-sourcecheck/index.ts'],
  },
  {
    name: 'Calendar and Canvas hosts the student links', kind: 'student-directed',
    purpose: 'Reading a calendar feed or Canvas instance the student pasted, relayed because those hosts refuse browser requests.',
    receives: 'The request to the address the student supplied, with the token they supplied.',
    when: 'student-opt-in', hosts: [], functions: ['fetchcal', 'canvas'],
    evidence: ['supabase/functions/fetchcal/index.ts', 'supabase/functions/canvas/index.ts'],
  },
  {
    name: 'The student’s browser push service', kind: 'student-directed',
    purpose: 'Delivering reminders the student switched on.',
    receives: 'An encrypted notification for the student’s device, via the push service their browser vendor runs.',
    when: 'student-opt-in', hosts: [], functions: ['push'],
    evidence: ['supabase/functions/push/index.ts', 'app/src/lib/privacy.ts'],
  },
];

const KIND_LABEL: Record<Kind, string> = {
  subprocessor: 'Subprocessor',
  'institution-directed': 'Institution-directed',
  'student-directed': 'Student-directed',
};
const WHEN_LABEL: Record<When, string> = {
  always: 'Always',
  'signed-in': 'When signed in',
  'institution-enabled': 'Only once an institution enables it',
  'student-opt-in': 'Only when the student turns it on',
  'form-sent': 'Only when someone sends a company-site form',
  'form-sent-or-opted-in-support-reply': 'Only when someone sends a company-site form or an opted-in student has a support reply',
};

/** The register as a Markdown table, which the document must contain verbatim. */
/** Whether a host is covered by a registered host, `*.example.org` included. */
export function registered(host: string, parties: readonly Party[] = PARTIES): boolean {
  return parties.some((p) =>
    p.hosts.some((h) => (h.startsWith('*.') ? host.endsWith(h.slice(1)) && host.length > h.length - 1 : host === h)),
  );
}

/**
 * The hosts in a space-separated list of origins (the build's extra
 * `connect-src`) that no party in the register covers.
 */
export function unregisteredHosts(origins: string | undefined, parties: readonly Party[] = PARTIES): string[] {
  const hosts = (origins ?? '').split(/\s+/).filter(Boolean).flatMap((o) => {
    try {
      return [new URL(o).host];
    } catch {
      return [];
    }
  });
  return [...new Set(hosts)].filter((h) => !registered(h, parties)).sort();
}

export function renderRegister(parties: readonly Party[] = PARTIES): string {
  const rows = parties.map((p) => `| ${p.name} | ${KIND_LABEL[p.kind]} | ${p.purpose} | ${p.receives} | ${WHEN_LABEL[p.when]} |`);
  return ['| Party | Kind | Purpose | Receives | When |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
}
