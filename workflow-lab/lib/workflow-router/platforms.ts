/**
 * Platform capability data for Claude Artifacts, ChatGPT Canvas and v0.
 *
 * Every claim here is a statement about the platform BOUNDARY (what each tool
 * is for), taken from the Semester specification. `level` is a 0-5 ordinal used
 * only so a column can be sorted; the `text` is what a reader should trust.
 */

export const PLATFORM_IDS = ["claude-artifacts", "chatgpt-canvas", "v0"] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  "claude-artifacts": "Claude Artifacts",
  "chatgpt-canvas": "ChatGPT Canvas",
  v0: "v0 Sandbox",
};

export function isPlatformId(value: unknown): value is PlatformId {
  return typeof value === "string" && (PLATFORM_IDS as readonly string[]).includes(value);
}

export type Capability = { level: 0 | 1 | 2 | 3 | 4 | 5; text: string };

export type PlatformProfile = {
  id: PlatformId;
  name: string;
  tagline: string;
  primaryUse: string;
  executionModel: string;
  sandboxLimits: string;
  react: Capability;
  clientState: Capability;
  persistentState: Capability;
  multiFile: Capability;
  serverApi: Capability;
  database: Capability;
  auth: Capability;
  documentExport: Capability;
  projectExport: Capability;
  github: Capability;
  deployment: Capability;
  bestSemesterUse: string;
  strengths: string[];
  boundaries: string[];
  exportFormats: string[];
};

export const PLATFORMS: Record<PlatformId, PlatformProfile> = {
  "claude-artifacts": {
    id: "claude-artifacts",
    name: "Claude Artifacts",
    tagline: "Self-contained, shareable, client-side deliverables.",
    primaryUse:
      "Self-contained interactive artifacts: local-state React tools, Mermaid/SVG diagrams, client-side exports and prototypes.",
    executionModel:
      "Rendered beside the chat in a restricted browser sandbox. Client-side only; libraries load from an approved CDN allow-list.",
    sandboxLimits:
      "No durable server runtime, no secret store, no arbitrary package installs, constrained network. Approved library hosts only (cdnjs, jsDelivr, Tailwind CDN, code.jquery.com, unpkg).",
    react: { level: 4, text: "React artifacts supported; libraries via approved CDNs only" },
    clientState: { level: 4, text: "Strong: useState/useReducer, in-memory filters, forms" },
    persistentState: { level: 1, text: "Transient. Treat artifact-local state as non-durable; not a production store" },
    multiFile: { level: 1, text: "Practically one self-contained file" },
    serverApi: { level: 0, text: "None. No durable server or API routes" },
    database: { level: 0, text: "None. Do not represent as a multi-tenant database application" },
    auth: { level: 0, text: "None. Not a production authentication system" },
    documentExport: { level: 3, text: "HTML, Markdown, SVG, Mermaid source; browser-generated CSV/PNG downloads" },
    projectExport: { level: 3, text: "JSX/HTML source copy or download; single-file handoff" },
    github: { level: 1, text: "Manual: copy source into a repository" },
    deployment: { level: 1, text: "Share link only; move source to a real codebase to deploy" },
    bestSemesterUse:
      "Artifact catalog, decision trees, ROI calculators, product prototypes, architecture diagrams, launch tools.",
    strengths: [
      "Fastest path from idea to a shareable interactive page",
      "Mermaid and SVG diagrams are a natural fit",
      "Client-side CSV/JSON/Markdown exports",
    ],
    boundaries: [
      "Not a durable backend, secret store, production auth system or multi-tenant database app",
      "Cannot hold private server-side environment variables",
      "State is lost when the artifact is closed unless an external system stores it",
    ],
    exportFormats: ["HTML", "JSX", "SVG", "Mermaid", "Markdown", "CSV (client-side)", "PNG (client-side)"],
  },
  "chatgpt-canvas": {
    id: "chatgpt-canvas",
    name: "ChatGPT Canvas",
    tagline: "Revision-centred writing, code iteration and analysis.",
    primaryUse:
      "Revision-centred writing, document production, code iteration, Python/data analysis and document/source-file export.",
    executionModel:
      "Collaborative editing surface. React/HTML render in an isolated preview; Python can run in the Canvas console.",
    sandboxLimits:
      "Isolated preview environment. Not a deployment target and not a durable production backend; secrets and hosting belong in a dedicated application environment. Availability varies by model/product surface.",
    react: { level: 3, text: "React/HTML render in an isolated preview; npm packages and many JS libraries work" },
    clientState: { level: 3, text: "Works in previews; not the primary focus" },
    persistentState: { level: 1, text: "Editing environment, not a persistence layer" },
    multiFile: { level: 2, text: "Single document/code file; project-like patterns are awkward" },
    serverApi: { level: 1, text: "Python can execute in-console; no hosted API routes" },
    database: { level: 0, text: "None. Not a database layer" },
    auth: { level: 0, text: "None. Not an authentication system" },
    documentExport: { level: 5, text: "PDF, Markdown and DOCX; code exports in its detected extension (.py, .js, .sql)" },
    projectExport: { level: 3, text: "Single source file in the detected language" },
    github: { level: 1, text: "Manual: copy exported source into a repository" },
    deployment: { level: 0, text: "None. Export and move into the target codebase or publishing workflow" },
    bestSemesterUse:
      "PRDs, technical design docs, legal first drafts, board memos, launch narratives, Python/CSV analysis, standalone code modules.",
    strengths: [
      "Best loop for draft → inspect → revise → export",
      "PDF / Markdown / DOCX document export",
      "Python data analysis with console output",
    ],
    boundaries: [
      "Not a durable production backend or deployment target",
      "Do not use it as the place secrets or user data live",
      "Product availability differs across models",
    ],
    exportFormats: ["PDF", "Markdown", "DOCX", ".py", ".js", ".ts", ".sql"],
  },
  v0: {
    id: "v0",
    name: "v0 Sandbox",
    tagline: "Multi-file Next.js apps with server logic, database, auth and Vercel.",
    primaryUse:
      "Multi-file React/Next.js apps, server-side logic, API routes, database work, authentication, project export, GitHub workflow and Vercel deployment.",
    executionModel:
      "VM-backed Node.js sandbox with a project filesystem, dependencies and commands; can run server code, API routes and database connections.",
    sandboxLimits:
      "Still an isolated sandbox: a preview that works is not a hardened production deployment. Require real validation, migrations, RLS, tests and environment variables before treating generated work as production-ready.",
    react: { level: 5, text: "Native React and Next.js with Tailwind and shadcn/ui" },
    clientState: { level: 5, text: "Full client state plus server components and actions" },
    persistentState: { level: 4, text: "Can connect to real databases; credentials, schema and security still need review" },
    multiFile: { level: 5, text: "Multi-file projects with a real filesystem" },
    serverApi: { level: 5, text: "Server code, route handlers and API routes" },
    database: { level: 4, text: "Postgres/Supabase connections; migrations and RLS must be reviewed" },
    auth: { level: 4, text: "Supabase Auth / app auth flows; session handling must be verified" },
    documentExport: { level: 2, text: "README/docs as project files; not a document editor" },
    projectExport: { level: 5, text: "Project/code export, repository import and export, file management" },
    github: { level: 5, text: "Git integration and GitHub-backed workflow" },
    deployment: { level: 5, text: "Vercel direct publish or GitHub-backed deployment" },
    bestSemesterUse:
      "A real Semester web product, admin dashboard, customer portal, authenticated app, API routes and database-backed workflows.",
    strengths: [
      "Real Next.js project structure and tooling",
      "Server code, API routes and database connections",
      "GitHub and Vercel workflow",
    ],
    boundaries: [
      "Generated code still needs tests, migrations, RLS review and environment-variable validation",
      "Preview ≠ production: pin dependencies and build in the target repository",
    ],
    exportFormats: ["Project files", "GitHub repository", "Vercel deployment", "ZIP"],
  },
};

export const PLATFORM_LIST: PlatformProfile[] = PLATFORM_IDS.map((id) => PLATFORMS[id]);

/** One row per comparison dimension; used by the dimension-by-platform matrix. */
export type MatrixDimension = {
  key: string;
  label: string;
  group: "Execution" | "Rendering" | "State" | "Project" | "Backend" | "Handoff";
  levels: Record<PlatformId, Capability>;
};

export const MATRIX_DIMENSIONS: MatrixDimension[] = [
  {
    key: "execution-limits",
    label: "Execution limits",
    group: "Execution",
    levels: {
      "claude-artifacts": { level: 2, text: "Client-side only; approved CDN hosts; no secrets" },
      "chatgpt-canvas": { level: 2, text: "Isolated preview; Python in console; no hosting" },
      v0: { level: 4, text: "VM-backed Node.js; server code, routes, shell commands" },
    },
  },
  {
    key: "react-support",
    label: "React support",
    group: "Rendering",
    levels: {
      "claude-artifacts": PLATFORMS["claude-artifacts"].react,
      "chatgpt-canvas": PLATFORMS["chatgpt-canvas"].react,
      v0: PLATFORMS.v0.react,
    },
  },
  {
    key: "rendering",
    label: "Rendering capability",
    group: "Rendering",
    levels: {
      "claude-artifacts": { level: 5, text: "Live HTML/React/SVG/Mermaid rendering beside the chat" },
      "chatgpt-canvas": { level: 3, text: "React/HTML preview; document view" },
      v0: { level: 5, text: "Full app preview in the sandbox" },
    },
  },
  {
    key: "local-state",
    label: "Local state",
    group: "State",
    levels: {
      "claude-artifacts": PLATFORMS["claude-artifacts"].clientState,
      "chatgpt-canvas": PLATFORMS["chatgpt-canvas"].clientState,
      v0: PLATFORMS.v0.clientState,
    },
  },
  {
    key: "persistent-state",
    label: "Persistent state",
    group: "State",
    levels: {
      "claude-artifacts": PLATFORMS["claude-artifacts"].persistentState,
      "chatgpt-canvas": PLATFORMS["chatgpt-canvas"].persistentState,
      v0: PLATFORMS.v0.persistentState,
    },
  },
  {
    key: "multi-file",
    label: "Multi-file projects",
    group: "Project",
    levels: {
      "claude-artifacts": PLATFORMS["claude-artifacts"].multiFile,
      "chatgpt-canvas": PLATFORMS["chatgpt-canvas"].multiFile,
      v0: PLATFORMS.v0.multiFile,
    },
  },
  {
    key: "server-api",
    label: "Server / API capability",
    group: "Backend",
    levels: {
      "claude-artifacts": PLATFORMS["claude-artifacts"].serverApi,
      "chatgpt-canvas": PLATFORMS["chatgpt-canvas"].serverApi,
      v0: PLATFORMS.v0.serverApi,
    },
  },
  {
    key: "database",
    label: "Database capability",
    group: "Backend",
    levels: {
      "claude-artifacts": PLATFORMS["claude-artifacts"].database,
      "chatgpt-canvas": PLATFORMS["chatgpt-canvas"].database,
      v0: PLATFORMS.v0.database,
    },
  },
  {
    key: "auth",
    label: "Authentication capability",
    group: "Backend",
    levels: {
      "claude-artifacts": PLATFORMS["claude-artifacts"].auth,
      "chatgpt-canvas": PLATFORMS["chatgpt-canvas"].auth,
      v0: PLATFORMS.v0.auth,
    },
  },
  {
    key: "export-formats",
    label: "Export & handoff formats",
    group: "Handoff",
    levels: {
      "claude-artifacts": { level: 3, text: PLATFORMS["claude-artifacts"].exportFormats.join(", ") },
      "chatgpt-canvas": { level: 4, text: PLATFORMS["chatgpt-canvas"].exportFormats.join(", ") },
      v0: { level: 5, text: PLATFORMS.v0.exportFormats.join(", ") },
    },
  },
  {
    key: "github-vercel",
    label: "GitHub / Vercel deployment fit",
    group: "Handoff",
    levels: {
      "claude-artifacts": { level: 1, text: "Manual copy to repository; no deploy" },
      "chatgpt-canvas": { level: 0, text: "Manual copy to repository; no deploy" },
      v0: { level: 5, text: "Git integration; Vercel publish or GitHub-backed deploy" },
    },
  },
];

/** Columns of the 16-field feature matrix, in the order the specification lists them. */
export type FeatureColumn = {
  key: string;
  label: string;
  /** "text" columns sort alphabetically, "level" columns sort by the 0-5 ordinal. */
  kind: "text" | "level";
  read: (p: PlatformProfile) => { sort: string | number; text: string };
};

const lv = (read: (p: PlatformProfile) => Capability): FeatureColumn["read"] => (p) => {
  const c = read(p);
  return { sort: c.level, text: c.text };
};
const tx = (read: (p: PlatformProfile) => string): FeatureColumn["read"] => (p) => {
  const t = read(p);
  return { sort: t.toLowerCase(), text: t };
};

export const FEATURE_COLUMNS: FeatureColumn[] = [
  { key: "platform", label: "Platform", kind: "text", read: tx((p) => p.name) },
  { key: "primaryUse", label: "Primary use", kind: "text", read: tx((p) => p.primaryUse) },
  { key: "executionModel", label: "Execution model", kind: "text", read: tx((p) => p.executionModel) },
  { key: "sandboxLimits", label: "Sandbox limits", kind: "text", read: tx((p) => p.sandboxLimits) },
  { key: "react", label: "React support", kind: "level", read: lv((p) => p.react) },
  { key: "clientState", label: "Client-side state", kind: "level", read: lv((p) => p.clientState) },
  { key: "persistentState", label: "Persistent state", kind: "level", read: lv((p) => p.persistentState) },
  { key: "multiFile", label: "Multi-file projects", kind: "level", read: lv((p) => p.multiFile) },
  { key: "serverApi", label: "Server code / API", kind: "level", read: lv((p) => p.serverApi) },
  { key: "database", label: "Database", kind: "level", read: lv((p) => p.database) },
  { key: "auth", label: "Authentication", kind: "level", read: lv((p) => p.auth) },
  { key: "documentExport", label: "Document export", kind: "level", read: lv((p) => p.documentExport) },
  { key: "projectExport", label: "Code / project export", kind: "level", read: lv((p) => p.projectExport) },
  { key: "github", label: "GitHub", kind: "level", read: lv((p) => p.github) },
  { key: "deployment", label: "Deployment", kind: "level", read: lv((p) => p.deployment) },
  { key: "bestSemesterUse", label: "Best Semester use case", kind: "text", read: tx((p) => p.bestSemesterUse) },
];
