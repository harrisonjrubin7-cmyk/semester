/**
 * The canonical benchmark: 12 workflows, one prompt each, run identically on
 * every platform. supabase/seed.sql is generated from this file
 * (scripts/generate-seed.ts) and a test fails if the two drift apart.
 */
import type { RouterInputs } from "@/lib/workflow-router/inputs";
import type { PlatformId } from "@/lib/workflow-router/platforms";

export const CRITERIA = [
  "correctness",
  "code_quality",
  "rendering",
  "state_management",
  "maintainability",
  "handoff",
  "sandbox_fit",
  "persistence",
] as const;
export type Criterion = (typeof CRITERIA)[number];

export const CRITERION_LABELS: Record<Criterion, string> = {
  correctness: "Correctness",
  code_quality: "Code quality",
  rendering: "Rendering",
  state_management: "State management",
  maintainability: "Maintainability",
  handoff: "Handoff / export",
  sandbox_fit: "Sandbox fit",
  persistence: "Persistence",
};

export const CRITERION_HELP: Record<Criterion, string> = {
  correctness: "Does the output satisfy every stated requirement and acceptance criterion?",
  code_quality: "Structure, types, error handling, clarity and defects.",
  rendering: "Visual output, responsiveness, accessibility and polish.",
  state_management: "Filters, forms, async state and predictable behavior.",
  maintainability: "Modularity, readability, extensibility and testability.",
  handoff: "Can the result be used in the next stage (export, source, repo, deploy)?",
  sandbox_fit: "Does the task suit the platform rather than fight its constraints?",
  persistence: "Does state survive a reload, in a storage mode appropriate to the task? Local UI state alone is not persistence.",
};

export const SCORE_LABELS = [
  "0 — Missing, unusable or fails the requirement",
  "1 — Barely addresses the requirement",
  "2 — Partially works with major omissions",
  "3 — Usable baseline with meaningful gaps",
  "4 — Strong, close to production quality",
  "5 — Excellent: complete, coherent, robust, well matched",
] as const;

/** Weights as integer percentages (no float drift). Persistence defaults to 0 unless a task needs it. */
export type WeightPercents = Record<Criterion, number>;

export const DEFAULT_WEIGHT_PERCENTS: WeightPercents = {
  correctness: 25,
  code_quality: 20,
  rendering: 15,
  state_management: 15,
  maintainability: 10,
  handoff: 10,
  sandbox_fit: 5,
  persistence: 0,
};

export type TaskCapabilities = {
  react?: boolean;
  typescript?: boolean;
  clientState?: boolean;
  csvExport?: boolean;
  python?: boolean;
  mermaid?: boolean;
  documentation?: boolean;
  serverCode?: boolean;
  database?: boolean;
  auth?: boolean;
  rls?: boolean;
  multiTenant?: boolean;
  nextjs?: boolean;
  supabase?: boolean;
  persistentState?: boolean;
};

export type BenchmarkWorkflow = {
  number: number;
  slug: string;
  title: string;
  category: string;
  prompt: string;
  requirements: string[];
  capabilities: TaskCapabilities;
  acceptanceCriteria: string[];
  recommendedPlatform: PlatformId;
  weights: WeightPercents;
  requiresPersistence: boolean;
  /** Router inputs that describe this workflow; the router should agree with recommendedPlatform. */
  scenario: RouterInputs;
};

const w = (
  correctness: number,
  code_quality: number,
  rendering: number,
  state_management: number,
  maintainability: number,
  handoff: number,
  sandbox_fit: number,
  persistence = 0,
): WeightPercents => ({ correctness, code_quality, rendering, state_management, maintainability, handoff, sandbox_fit, persistence });

export const BENCHMARK_WORKFLOWS: BenchmarkWorkflow[] = [
  {
    number: 1,
    slug: "sortable-artifact-tracker",
    title: "Sortable artifact tracker",
    category: "React UI",
    prompt:
      "Build a responsive client-side artifact tracker with 100 sample records, search, multi-select filters, sorting, status updates, a detail drawer, local state, CSV export, and accessible keyboard controls.",
    requirements: [
      "100 realistic sample records",
      "Search, multi-select filters and sortable columns",
      "Status updates reflected in the table",
      "Detail drawer",
      "CSV export",
      "Keyboard-accessible controls",
    ],
    capabilities: { react: true, clientState: true, csvExport: true },
    acceptanceCriteria: [
      "Exactly 100 sample records load",
      "Search narrows rows; multi-select filters combine correctly",
      "Every sortable column toggles ascending/descending",
      "Changing a status updates the row and any active filter",
      "CSV download contains the currently filtered rows",
      "All controls reachable and operable by keyboard; drawer traps and restores focus",
    ],
    recommendedPlatform: "claude-artifacts",
    weights: w(25, 20, 20, 20, 10, 3, 2),
    requiresPersistence: false,
    scenario: { deliverable: "interactive-tool", interaction: "complex-local", backend: "file-export", tech: "react", persistence: "none", handoff: "share-immediately" },
  },
  {
    number: 2,
    slug: "interactive-onboarding-prototype",
    title: "Interactive onboarding prototype",
    category: "Product design",
    prompt:
      "Build a clickable product onboarding prototype with an empty state, a multi-step setup flow, realistic sample data, validation feedback, completion state, and responsive layouts.",
    requirements: ["Empty state", "Multi-step setup flow", "Realistic sample data", "Inline validation feedback", "Completion state", "Responsive layouts"],
    capabilities: { react: true, clientState: true },
    acceptanceCriteria: [
      "Empty state leads into step 1",
      "Steps cannot be skipped while invalid; errors name the field",
      "Back/next preserves entered values",
      "Completion state summarizes the setup",
      "Layout works at phone and desktop widths",
    ],
    recommendedPlatform: "claude-artifacts",
    weights: w(20, 15, 30, 20, 5, 5, 5),
    requiresPersistence: false,
    scenario: { deliverable: "product-prototype", interaction: "complex-local", backend: "none", tech: "react", persistence: "none", handoff: "share-immediately" },
  },
  {
    number: 3,
    slug: "b2b-saas-landing-page",
    title: "B2B SaaS landing page",
    category: "Marketing",
    prompt:
      "Build a polished responsive B2B SaaS landing page with navigation, hero, product workflow, benefits, proof, testimonial placeholders, FAQ, pricing CTA, and accessible semantic HTML.",
    requirements: ["Navigation", "Hero", "Product workflow section", "Benefits and proof", "Testimonial placeholders", "FAQ", "Pricing CTA", "Semantic, accessible HTML"],
    capabilities: { react: false },
    acceptanceCriteria: [
      "All listed sections present, in a sensible narrative order",
      "Uses landmark elements and a single h1; passes a contrast check",
      "Responsive from 360px to 1440px with no horizontal scroll",
      "FAQ is keyboard operable",
      "Placeholders are clearly marked, not fabricated customer claims",
    ],
    recommendedPlatform: "claude-artifacts",
    weights: w(20, 15, 35, 5, 10, 10, 5),
    requiresPersistence: false,
    scenario: { deliverable: "marketing-page", interaction: "simple-local", backend: "none", tech: "html-css-js", persistence: "none", handoff: "share-immediately" },
  },
  {
    number: 4,
    slug: "multi-tenant-system-architecture-diagram",
    title: "Multi-tenant system architecture diagram",
    category: "Engineering",
    prompt:
      "Create a Mermaid architecture diagram for a Next.js application using Supabase Auth, Postgres, Storage, Row Level Security, Stripe, webhooks, Vercel deployment, observability, and audit logs.",
    requirements: ["Valid Mermaid syntax", "All named services present", "Trust boundaries and data flow direction", "Legend or notes"],
    capabilities: { mermaid: true, documentation: true },
    acceptanceCriteria: [
      "Diagram renders without syntax errors",
      "Every service in the prompt appears exactly once",
      "Client, server and database trust boundaries are distinguishable",
      "Webhook ingress and audit-log writes are shown",
      "Source is exportable as a .mmd file",
    ],
    recommendedPlatform: "claude-artifacts",
    weights: w(30, 5, 30, 5, 10, 15, 5),
    requiresPersistence: false,
    scenario: { deliverable: "diagram", interaction: "none", backend: "none", tech: "none", persistence: "none", handoff: "share-immediately" },
  },
  {
    number: 5,
    slug: "technical-design-document",
    title: "Technical design document",
    category: "Engineering documentation",
    prompt:
      "Write a technical design document for a multi-tenant artifact catalog. Include context, goals, non-goals, user flows, architecture, data model, RLS, API design, risks, failure modes, observability, rollout, testing, and open questions.",
    requirements: ["All fourteen named sections", "Concrete data model", "RLS described per table", "Explicit risks and open questions"],
    capabilities: { documentation: true },
    acceptanceCriteria: [
      "Every requested section present and non-trivial",
      "Data model lists tables, keys and relationships",
      "RLS section states who can read/write each table",
      "Open questions are real unknowns, not filler",
      "Exports cleanly to Markdown and DOCX/PDF",
    ],
    recommendedPlatform: "chatgpt-canvas",
    weights: w(35, 5, 10, 5, 15, 25, 5),
    requiresPersistence: false,
    scenario: { deliverable: "document", interaction: "none", backend: "none", tech: "none", persistence: "none", handoff: "document-export" },
  },
  {
    number: 6,
    slug: "product-launch-presentation",
    title: "Product launch presentation",
    category: "GTM",
    prompt:
      "Create a slide-by-slide product launch narrative for a B2B SaaS feature. Cover audience, problem, positioning, product walkthrough, proof, launch channels, sales enablement, timeline, metrics, risks, and speaker notes.",
    requirements: ["Slide-by-slide structure", "All named topics covered", "Speaker notes per slide", "Metrics and timeline"],
    capabilities: { documentation: true },
    acceptanceCriteria: [
      "Each slide has a title, key points and speaker notes",
      "Narrative flows from problem to metrics to risks",
      "Metrics are measurable and time-bound",
      "No fabricated customer proof presented as fact",
      "Exportable to Markdown or DOCX/PDF",
    ],
    recommendedPlatform: "chatgpt-canvas",
    weights: w(25, 5, 25, 5, 10, 25, 5),
    requiresPersistence: false,
    scenario: { deliverable: "presentation", interaction: "none", backend: "none", tech: "none", persistence: "none", handoff: "document-export" },
  },
  {
    number: 7,
    slug: "subscription-csv-analysis",
    title: "Subscription CSV analysis",
    category: "Analytics",
    prompt:
      "Write a Python script that reads subscription events from CSV, computes monthly active customers, gross logo churn, gross revenue churn, net revenue retention, creates a clean summary CSV, and produces a short Markdown report.",
    requirements: ["Reads subscription events CSV", "Monthly active customers", "Gross logo churn and gross revenue churn", "Net revenue retention", "Summary CSV and Markdown report"],
    capabilities: { python: true, csvExport: true },
    acceptanceCriteria: [
      "Script runs against a sample CSV without errors",
      "Metric definitions are stated and calculated correctly on a hand-checked sample",
      "Handles missing/duplicate rows with explicit behavior",
      "Writes summary CSV and Markdown report files",
      "No network access or secrets required",
    ],
    recommendedPlatform: "chatgpt-canvas",
    weights: w(30, 25, 5, 10, 15, 10, 5),
    requiresPersistence: false,
    scenario: { deliverable: "data-analysis", interaction: "none", backend: "file-export", tech: "none", persistence: "none", handoff: "document-export" },
  },
  {
    number: 8,
    slug: "reusable-react-metric-dashboard",
    title: "Reusable React metric dashboard",
    category: "React UI",
    prompt:
      "Build a reusable TypeScript React dashboard component with KPI cards, loading and empty states, filters, a data table, an accessible modal detail view, and realistic mock data. Do not use external UI libraries.",
    requirements: ["TypeScript", "KPI cards", "Loading and empty states", "Filters and data table", "Accessible modal", "No external UI libraries"],
    capabilities: { react: true, typescript: true, clientState: true },
    acceptanceCriteria: [
      "Compiles under strict TypeScript",
      "Loading, empty and populated states are all reachable",
      "Filters update KPIs and table consistently",
      "Modal traps focus, closes on Escape and restores focus",
      "No UI-library dependencies; props are typed and documented",
    ],
    recommendedPlatform: "v0",
    weights: w(25, 25, 20, 20, 5, 3, 2),
    requiresPersistence: false,
    scenario: { deliverable: "react-component", interaction: "complex-local", backend: "none", tech: "react", persistence: "none", handoff: "github" },
  },
  {
    number: 9,
    slug: "authenticated-nextjs-route-handler",
    title: "Authenticated Next.js route handler",
    category: "Next.js",
    prompt:
      "Build a Next.js App Router route handler for creating artifact records. Require authentication, validate request data, enforce organization membership, return typed JSON errors, and document request/response examples.",
    requirements: ["Route handler", "Authentication required", "Request validation", "Organization membership enforced", "Typed JSON errors", "Request/response examples"],
    capabilities: { nextjs: true, serverCode: true, auth: true, database: true, persistentState: true },
    acceptanceCriteria: [
      "Unauthenticated requests return 401 with a typed error body",
      "Invalid bodies return 400 with field-level errors",
      "A non-member of the organization receives 403/404, never the record",
      "Valid requests persist a row and return it",
      "Examples match the real behavior",
    ],
    recommendedPlatform: "v0",
    weights: w(25, 20, 5, 10, 10, 5, 10, 15),
    requiresPersistence: true,
    scenario: { deliverable: "full-stack-feature", interaction: "none", backend: "server-api", tech: "nextjs", persistence: "database", handoff: "github" },
  },
  {
    number: 10,
    slug: "supabase-artifact-crud-workflow",
    title: "Supabase artifact CRUD workflow",
    category: "Full stack",
    prompt:
      "Build a Next.js App Router artifact catalog backed by Supabase Postgres. Include migration SQL, RLS, server actions, typed queries, create/edit/delete flows, filtering, validation, loading states, and error handling.",
    requirements: ["Migration SQL", "RLS policies", "Server actions", "Typed queries", "Create/edit/delete", "Filtering, validation, loading and error states"],
    capabilities: { nextjs: true, supabase: true, database: true, rls: true, serverCode: true, persistentState: true },
    acceptanceCriteria: [
      "Migration applies cleanly to an empty database",
      "RLS blocks another user's rows (verified with two users)",
      "Create, edit and delete persist across a reload",
      "Invalid input is rejected server-side with messages",
      "Loading and error states are visible in the UI",
    ],
    recommendedPlatform: "v0",
    weights: w(25, 15, 5, 15, 10, 5, 5, 20),
    requiresPersistence: true,
    scenario: { deliverable: "full-stack-feature", interaction: "complex-local", backend: "database", tech: "next-supabase", persistence: "database", handoff: "github" },
  },
  {
    number: 11,
    slug: "cookie-based-supabase-auth",
    title: "Cookie-based Supabase Auth",
    category: "Authentication",
    prompt:
      "Build Supabase Auth for Next.js App Router using separate browser/server clients, session refresh middleware, a magic-link sign-in page, protected routes, sign-out, and secure environment variable guidance.",
    requirements: ["Separate browser and server clients", "Session refresh middleware/proxy", "Magic-link sign-in page", "Protected routes", "Sign-out", "Environment variable guidance"],
    capabilities: { nextjs: true, supabase: true, auth: true, serverCode: true, persistentState: true },
    acceptanceCriteria: [
      "Uses @supabase/ssr with distinct browser and server clients",
      "Session is refreshed on each request; server validates with getUser()",
      "Magic link completes through a token-hash confirm route",
      "Protected routes redirect when signed out; session survives reload",
      "No service-role key is exposed to the browser",
    ],
    recommendedPlatform: "v0",
    weights: w(30, 15, 5, 15, 10, 5, 5, 15),
    requiresPersistence: true,
    scenario: { deliverable: "full-stack-feature", interaction: "simple-local", backend: "auth-secrets", tech: "next-supabase", persistence: "auth", handoff: "github" },
  },
  {
    number: 12,
    slug: "multi-tenant-saas-workspace",
    title: "Multi-tenant SaaS workspace",
    category: "SaaS architecture",
    prompt:
      "Build a multi-tenant Next.js workspace with organizations, memberships, owner/admin/member/viewer roles, Supabase Auth, Postgres tables, Row Level Security, server-side authorization, audit logs, and a responsive admin dashboard.",
    requirements: ["Organizations and memberships", "Four roles", "Supabase Auth", "RLS on every table", "Server-side authorization", "Audit logs", "Responsive admin dashboard"],
    capabilities: { nextjs: true, supabase: true, auth: true, rls: true, multiTenant: true, serverCode: true, database: true, persistentState: true },
    acceptanceCriteria: [
      "A member of org A cannot read or write org B's rows",
      "A viewer cannot write; only owner/admin manage members",
      "The last owner cannot be removed",
      "Security-relevant actions write audit-log rows",
      "Dashboard is responsive and shows loading/empty/error states",
    ],
    recommendedPlatform: "v0",
    weights: w(30, 15, 5, 15, 5, 5, 5, 20),
    requiresPersistence: true,
    scenario: { deliverable: "full-stack-feature", interaction: "multi-user", backend: "auth-secrets", tech: "next-supabase", persistence: "multi-tenant", handoff: "vercel" },
  },
];

export const SUITE_NAME = "Semester AI Workspace Benchmark — 12 Workflows";
export const TEMPLATE_SUITE_ID = "00000000-0000-4000-8000-0000000b3c01";

export function workflowByNumber(n: number): BenchmarkWorkflow | undefined {
  return BENCHMARK_WORKFLOWS.find((x) => x.number === n);
}

export type BenchmarkExecutionConfig = {
  suiteName: string;
  runPlatforms: PlatformId[];
  workflows: number[];
  enforceSamePrompt: boolean;
  enforceFreshSession: boolean;
  captureSourceFiles: boolean;
  capturePreviewUrl: boolean;
  captureConsoleOutput: boolean;
  runStaticChecks: boolean;
  runPersistenceProbe: boolean;
  requireHumanReview: boolean;
  timeoutSeconds: number;
};

export const BENCHMARK_EXECUTION_CONFIG: BenchmarkExecutionConfig = {
  suiteName: SUITE_NAME,
  runPlatforms: ["claude-artifacts", "chatgpt-canvas", "v0"],
  workflows: BENCHMARK_WORKFLOWS.map((x) => x.number),
  enforceSamePrompt: true,
  enforceFreshSession: true,
  captureSourceFiles: true,
  capturePreviewUrl: true,
  captureConsoleOutput: true,
  runStaticChecks: true,
  runPersistenceProbe: true,
  requireHumanReview: true,
  timeoutSeconds: 600,
};

export function validateExecutionConfig(c: BenchmarkExecutionConfig): string[] {
  const errors: string[] = [];
  if (!c.enforceSamePrompt) errors.push("Benchmark invalid: every platform must receive the same canonical prompt.");
  if (!c.requireHumanReview) errors.push("Benchmark incomplete: static checks do not replace human review.");
  if (c.runPersistenceProbe && !c.enforceFreshSession) errors.push("Persistence testing requires a fresh-session or refresh boundary.");
  if (c.runPlatforms.length === 0) errors.push("At least one platform is required.");
  return errors;
}
