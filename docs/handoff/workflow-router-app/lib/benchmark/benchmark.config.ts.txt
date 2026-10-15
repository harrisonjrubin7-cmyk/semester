export const PLATFORMS = ['claude-artifacts', 'chatgpt-canvas', 'v0'] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PLATFORM_LABEL: Record<Platform, string> = { 'claude-artifacts': 'Claude Artifacts', 'chatgpt-canvas': 'ChatGPT Canvas', v0: 'v0' };

export const CRITERIA = ['correctness', 'codeQuality', 'rendering', 'stateManagement', 'maintainability', 'handoff', 'sandboxFit', 'persistence'] as const;
export type Criterion = (typeof CRITERIA)[number];
export type Weights = Partial<Record<Criterion, number>>;

/** Default weights (sum 1.0). Persistence is graded but carries 0 weight unless a task overrides it. */
export const DEFAULT_WEIGHTS: Weights = { correctness: 0.25, codeQuality: 0.2, rendering: 0.15, stateManagement: 0.15, maintainability: 0.1, handoff: 0.1, sandboxFit: 0.05, persistence: 0 };

export const PERSISTENCE_MODES = ['none', 'local-preview', 'browser-local', 'session', 'database', 'project-backed'] as const;
export type PersistenceMode = (typeof PERSISTENCE_MODES)[number];

export interface WorkflowSpec { number: number; slug: string; title: string; category: string; prompt: string; requirements: string[]; acceptance: string[]; recommended: Platform; requiresPersistence: boolean; weights?: Weights }

const P = (w: Weights) => w;
export const WORKFLOWS: WorkflowSpec[] = [
  { number: 1, slug: 'artifact-tracker', title: 'Sortable artifact tracker', category: 'Interactive tool', recommended: 'claude-artifacts', requiresPersistence: false,
    prompt: 'Build a single-file React tracker of every Semester artifact with search, category/format/priority filters, sortable columns and CSV export. No external services.',
    requirements: ['Search', 'Multi-filter', 'Sortable columns', 'CSV export'], acceptance: ['Sort is stable per column', 'Filters combine with AND', 'CSV reflects current view'] },
  { number: 2, slug: 'onboarding-prototype', title: 'Interactive onboarding prototype', category: 'Product prototype', recommended: 'claude-artifacts', requiresPersistence: false,
    prompt: 'Prototype Semester student onboarding: add a syllabus, connect a calendar, or use sample data; consent one decision at a time; first next step with its source label.',
    requirements: ['3 entry paths', 'Consent steps', 'Back/forward', 'Keyboard reachable'], acceptance: ['Every step reachable by keyboard', 'Decline is equal weight'] },
  { number: 3, slug: 'b2b-landing', title: 'B2B SaaS landing page', category: 'Marketing page', recommended: 'claude-artifacts', requiresPersistence: false,
    prompt: 'Design a Semester institution landing page: one clear next step, status of every capability (use now / pilot / later), no unapproved claims.',
    requirements: ['Hero', 'Capability status map', 'Trust section', 'Responsive'], acceptance: ['No prohibited claims', 'Passes 320px reflow'] },
  { number: 4, slug: 'architecture-diagram', title: 'Multi-tenant system architecture diagram', category: 'Diagram', recommended: 'claude-artifacts', requiresPersistence: false,
    prompt: 'Draw Semester multi-tenant architecture as Mermaid: tenants, Supabase Postgres with RLS, edge functions, SIS/LMS connectors, audit log.',
    requirements: ['Mermaid source', 'Tenant boundary', 'Data flows labelled'], acceptance: ['Renders without errors', 'RLS boundary explicit'] },
  { number: 5, slug: 'tech-design-doc', title: 'Technical design document', category: 'Document', recommended: 'chatgpt-canvas', requiresPersistence: false,
    prompt: 'Write a technical design document for Semester degree-audit sync: context, goals, non-goals, design, data model, risks, rollout, open questions.',
    requirements: ['Standard TDD sections', 'Data model', 'Risks'], acceptance: ['Exports to DOCX/PDF/Markdown', 'Revision history usable'], weights: P({ correctness: 0.3, codeQuality: 0.05, rendering: 0.05, stateManagement: 0, maintainability: 0.2, handoff: 0.35, sandboxFit: 0.05 }) },
  { number: 6, slug: 'launch-presentation', title: 'Product launch presentation', category: 'Presentation', recommended: 'chatgpt-canvas', requiresPersistence: false,
    prompt: 'Draft a 10-slide Semester pilot launch presentation for a registrar audience: scope, status, what stays official, evidence, next step.',
    requirements: ['10 slides', 'Speaker notes', 'Status honesty'], acceptance: ['Exports a usable deck or outline'], weights: P({ correctness: 0.3, codeQuality: 0, rendering: 0.25, stateManagement: 0, maintainability: 0.1, handoff: 0.3, sandboxFit: 0.05 }) },
  { number: 7, slug: 'subscription-csv', title: 'Subscription CSV analysis', category: 'Data analysis', recommended: 'chatgpt-canvas', requiresPersistence: false,
    prompt: 'Analyse the attached subscription CSV: MRR by month, churn, cohort retention; state assumptions; export cleaned CSV and a chart.',
    requirements: ['Python execution', 'Cohort table', 'Chart', 'Cleaned export'], acceptance: ['Numbers reproducible from code', 'Assumptions listed'] },
  { number: 8, slug: 'metric-dashboard', title: 'Reusable React metric dashboard', category: 'React component', recommended: 'claude-artifacts', requiresPersistence: false,
    prompt: 'Build a reusable <MetricDashboard> React component: typed props, metric tiles with source and age, provenance-encoded bars, empty/loading/error states.',
    requirements: ['Typed props', 'States', 'Accessible chart table'], acceptance: ['Component is self-contained', 'All states render'] },
  { number: 9, slug: 'auth-route-handler', title: 'Authenticated Next.js route handler', category: 'Full-stack feature', recommended: 'v0', requiresPersistence: true,
    prompt: 'Implement app/api/recommendations/route.ts: Supabase server client, auth.getUser(), Zod validation, insert scoped to the user, 401/422 responses.',
    requirements: ['@supabase/ssr', 'getUser on server', 'Zod', 'Typed responses'], acceptance: ['Unauthenticated → 401', 'Invalid body → 422', 'Row visible only to owner'] },
  { number: 10, slug: 'supabase-crud', title: 'Supabase artifact CRUD workflow', category: 'Full-stack feature', recommended: 'v0', requiresPersistence: true,
    prompt: 'Create artifact CRUD with Supabase: migration, RLS, server actions for create/update/delete, optimistic UI, revalidation.',
    requirements: ['Migration', 'RLS', 'Server Actions', 'Revalidate'], acceptance: ['Survives reload', 'RLS denies other users'] },
  { number: 11, slug: 'cookie-auth', title: 'Cookie-based Supabase Auth', category: 'Full-stack feature', recommended: 'v0', requiresPersistence: true,
    prompt: 'Implement cookie-based Supabase Auth with @supabase/ssr: browser/server clients, middleware session refresh, magic link, confirm route, sign-out.',
    requirements: ['Middleware refresh', 'Magic link', 'Confirm route', 'Sign-out'], acceptance: ['Session survives reload', 'No service key in client bundle'] },
  { number: 12, slug: 'multi-tenant-workspace', title: 'Multi-tenant SaaS workspace', category: 'Full-stack feature', recommended: 'v0', requiresPersistence: true,
    prompt: 'Build organizations, memberships (owner/admin/member/viewer), org switcher, invite flow and org-scoped RLS for shared records.',
    requirements: ['Org tables', 'Role enum', 'RLS by membership', 'Org switcher'], acceptance: ['Viewer cannot write', 'Non-member sees nothing'], weights: P({ correctness: 0.25, codeQuality: 0.15, rendering: 0.05, stateManagement: 0.1, maintainability: 0.1, handoff: 0.1, sandboxFit: 0.05, persistence: 0.2 }) },
];
