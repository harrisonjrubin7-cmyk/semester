/** Decision-tree questions, their allowed answers, and the typed input shape. */

export type Option<V extends string> = { value: V; label: string; description: string };
export type Question<K extends string, V extends string> = {
  key: K;
  title: string;
  help: string;
  options: Option<V>[];
};

export const DELIVERABLES = [
  "interactive-tool",
  "product-prototype",
  "marketing-page",
  "diagram",
  "document",
  "presentation",
  "data-analysis",
  "react-component",
  "full-stack-feature",
] as const;
export const INTERACTIONS = ["none", "simple-local", "complex-local", "multi-user"] as const;
export const BACKENDS = ["none", "file-export", "database", "server-api", "auth-secrets"] as const;
export const TECH_TARGETS = ["none", "html-css-js", "react", "nextjs", "next-postgres", "next-supabase"] as const;
export const PERSISTENCE = ["none", "database", "auth", "storage", "realtime", "multi-tenant"] as const;
export const HANDOFFS = ["share-immediately", "document-export", "github", "vercel"] as const;

export type Deliverable = (typeof DELIVERABLES)[number];
export type Interaction = (typeof INTERACTIONS)[number];
export type Backend = (typeof BACKENDS)[number];
export type TechTarget = (typeof TECH_TARGETS)[number];
export type Persistence = (typeof PERSISTENCE)[number];
export type Handoff = (typeof HANDOFFS)[number];

export type RouterInputs = {
  deliverable: Deliverable;
  interaction: Interaction;
  backend: Backend;
  tech: TechTarget;
  persistence: Persistence;
  handoff: Handoff;
};

export const DEFAULT_INPUTS: RouterInputs = {
  deliverable: "interactive-tool",
  interaction: "simple-local",
  backend: "none",
  tech: "react",
  persistence: "none",
  handoff: "share-immediately",
};

export const QUESTIONS = [
  {
    key: "deliverable",
    title: "What are you producing?",
    help: "The shape of the final deliverable.",
    options: [
      { value: "interactive-tool", label: "Interactive tool", description: "Tracker, calculator, explainer or dashboard" },
      { value: "product-prototype", label: "Product prototype", description: "Clickable flow with realistic sample data" },
      { value: "marketing-page", label: "Marketing page", description: "Landing page or campaign site" },
      { value: "diagram", label: "Diagram", description: "Architecture, flow or data map" },
      { value: "document", label: "Document", description: "PRD, design doc, policy or memo" },
      { value: "presentation", label: "Presentation", description: "Slide-by-slide narrative" },
      { value: "data-analysis", label: "Data analysis", description: "CSV in, computed summary out" },
      { value: "react-component", label: "React component", description: "Reusable, typed UI component" },
      { value: "full-stack-feature", label: "Full-stack feature", description: "Routes, data and UI together" },
    ],
  },
  {
    key: "interaction",
    title: "How interactive is it?",
    help: "Who changes state, and where does it live?",
    options: [
      { value: "none", label: "None", description: "Static output" },
      { value: "simple-local", label: "Simple local interaction", description: "Toggles, filters, small forms" },
      { value: "complex-local", label: "Complex local state", description: "Multi-step flows, derived state, tables" },
      { value: "multi-user", label: "Multi-user collaboration", description: "More than one person edits shared data" },
    ],
  },
  {
    key: "backend",
    title: "What backend does it need?",
    help: "Anything beyond the browser.",
    options: [
      { value: "none", label: "None", description: "Runs entirely in the browser" },
      { value: "file-export", label: "File export", description: "Download a CSV, JSON, Markdown or document" },
      { value: "database", label: "Database", description: "Rows written and read server-side" },
      { value: "server-api", label: "Server API", description: "Route handlers, server actions or webhooks" },
      { value: "auth-secrets", label: "Auth / secrets", description: "Sign-in or private server-side secrets" },
    ],
  },
  {
    key: "tech",
    title: "Technology target",
    help: "Hard constraints on the stack.",
    options: [
      { value: "none", label: "None", description: "No preference" },
      { value: "html-css-js", label: "HTML / CSS / JavaScript", description: "No framework" },
      { value: "react", label: "React", description: "Client-side React" },
      { value: "nextjs", label: "Next.js", description: "App Router project" },
      { value: "next-postgres", label: "Next.js + Postgres", description: "Server components with SQL" },
      { value: "next-supabase", label: "Next.js + Supabase/Auth", description: "Supabase Postgres, Auth and RLS" },
    ],
  },
  {
    key: "persistence",
    title: "Persistence & access",
    help: "What must survive a reload, and who may see it.",
    options: [
      { value: "none", label: "No persistence", description: "Nothing needs to survive" },
      { value: "database", label: "Database", description: "Persistent records" },
      { value: "auth", label: "Authentication", description: "Signed-in users" },
      { value: "storage", label: "Storage", description: "Uploaded files" },
      { value: "realtime", label: "Realtime", description: "Live updates between users" },
      { value: "multi-tenant", label: "Multi-tenant workspace", description: "Organizations, members and roles" },
    ],
  },
  {
    key: "handoff",
    title: "Handoff",
    help: "How the result leaves the platform.",
    options: [
      { value: "share-immediately", label: "Share immediately", description: "A link or paste in chat" },
      { value: "document-export", label: "Document / source export", description: "PDF, DOCX, Markdown or a source file" },
      { value: "github", label: "GitHub", description: "Commits and pull requests" },
      { value: "vercel", label: "Deploy to Vercel", description: "Preview and production deployments" },
    ],
  },
] as const satisfies readonly Question<string, string>[];

export type QuestionKey = (typeof QUESTIONS)[number]["key"];

export const OPTION_LABELS: Record<QuestionKey, Record<string, string>> = Object.fromEntries(
  QUESTIONS.map((q) => [
    q.key,
    Object.fromEntries(q.options.map((o) => [o.value, o.label])),
  ]),
) as Record<QuestionKey, Record<string, string>>;

export function labelFor(key: QuestionKey, value: string): string {
  return OPTION_LABELS[key][value] ?? value;
}
