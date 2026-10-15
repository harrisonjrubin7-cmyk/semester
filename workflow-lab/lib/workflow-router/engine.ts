/**
 * Workflow routing engine.
 *
 * Two layers, in order:
 *   1. Hard v0 triggers. Any selection that needs a real project, a server, a
 *      database, auth, secrets, multi-user access or a deployment pipeline sends
 *      the work to v0. These are not weighed against anything: a client-side
 *      artifact preview is not an equivalent for them.
 *   2. Weighted scoring between the three platforms for everything else.
 *
 * The engine is pure and deterministic so the same inputs always produce the
 * same recommendation, which is what makes the exports and tests meaningful.
 */
import {
  type Backend,
  type Deliverable,
  type Handoff,
  type Interaction,
  type Persistence,
  type RouterInputs,
  type TechTarget,
} from "./inputs";
import { PLATFORM_IDS, PLATFORMS, type PlatformId } from "./platforms";

export type Scores = Record<PlatformId, number>;
type Rule = { scores: Scores; why: string };
const s = (claude: number, canvas: number, v0: number): Scores => ({
  "claude-artifacts": claude,
  "chatgpt-canvas": canvas,
  v0,
});

const DELIVERABLE_RULES: Record<Deliverable, Rule> = {
  "interactive-tool": { scores: s(6, 2, 3), why: "Self-contained interactive tools are Claude Artifacts' strongest fit." },
  "product-prototype": { scores: s(6, 1, 3), why: "Clickable prototypes with local sample data render best as an artifact." },
  "marketing-page": { scores: s(5, 1, 3), why: "A single-page marketing site is a contained, visual deliverable." },
  diagram: { scores: s(6, 2, 1), why: "Mermaid and SVG diagrams are a natural artifact output." },
  document: { scores: s(1, 6, 0), why: "Revision-centred document production is Canvas's core loop." },
  presentation: { scores: s(2, 6, 0), why: "A slide-by-slide narrative is iterated as a document, then exported." },
  "data-analysis": { scores: s(1, 6, 1), why: "Canvas can run Python and export the resulting files." },
  "react-component": { scores: s(4, 3, 4), why: "A reusable component benefits from a real project, but a prototype can start anywhere." },
  "full-stack-feature": { scores: s(0, 0, 8), why: "A full-stack feature needs routes, data and UI in one project." },
};

const INTERACTION_RULES: Record<Interaction, Rule> = {
  none: { scores: s(0, 1, 0), why: "No interaction keeps this a static output." },
  "simple-local": { scores: s(3, 0, 1), why: "Simple local interaction runs comfortably inside an artifact." },
  "complex-local": { scores: s(3, 0, 3), why: "Complex local state fits an artifact, and is stronger still in a real project." },
  "multi-user": { scores: s(0, 0, 8), why: "Multi-user collaboration needs shared, server-held state." },
};

const BACKEND_RULES: Record<Backend, Rule> = {
  none: { scores: s(2, 1, 0), why: "No backend keeps everything in the browser." },
  "file-export": { scores: s(2, 3, 0), why: "File export works client-side (Claude) or as document export (Canvas)." },
  database: { scores: s(0, 0, 8), why: "A database needs a server and credentials." },
  "server-api": { scores: s(0, 0, 8), why: "Server APIs and webhooks need a runtime that can host routes." },
  "auth-secrets": { scores: s(0, 0, 8), why: "Sign-in and private secrets can never live in a client-side preview." },
};

const TECH_RULES: Record<TechTarget, Rule> = {
  none: { scores: s(0, 0, 0), why: "No stack constraint." },
  "html-css-js": { scores: s(3, 1, 0), why: "Plain HTML/CSS/JS is exactly what an artifact renders." },
  react: { scores: s(2, 2, 2), why: "Client-side React is supported on all three." },
  nextjs: { scores: s(0, 0, 8), why: "Next.js is a multi-file project with a server runtime." },
  "next-postgres": { scores: s(0, 0, 9), why: "Next.js with Postgres needs server code and a database connection." },
  "next-supabase": { scores: s(0, 0, 9), why: "Next.js with Supabase needs SSR clients, Auth and RLS." },
};

const PERSISTENCE_RULES: Record<Persistence, Rule> = {
  none: { scores: s(1, 1, 0), why: "Nothing needs to survive a reload." },
  database: { scores: s(0, 0, 8), why: "Persistent records need a database." },
  auth: { scores: s(0, 0, 8), why: "Authenticated users need a real session layer." },
  storage: { scores: s(0, 0, 8), why: "Uploaded files need durable object storage." },
  realtime: { scores: s(0, 0, 8), why: "Realtime sync needs a shared server channel." },
  "multi-tenant": { scores: s(0, 0, 9), why: "Organization workspaces need memberships, roles and RLS." },
};

const HANDOFF_RULES: Record<Handoff, Rule> = {
  "share-immediately": { scores: s(3, 0, 0), why: "A shareable link is the quickest handoff." },
  "document-export": { scores: s(1, 4, 0), why: "PDF, DOCX and source-file export is Canvas's handoff." },
  github: { scores: s(0, 0, 6), why: "A GitHub-backed workflow implies a real repository and project." },
  vercel: { scores: s(0, 0, 8), why: "Vercel deployment needs a deployable project." },
};

export type Trigger = { id: string; label: string; detail: string };

/** Selections that force v0. The ids are stable: tests and exports reference them. */
export function v0Triggers(i: RouterInputs): Trigger[] {
  const t: Trigger[] = [];
  const add = (id: string, label: string, detail: string) => t.push({ id, label, detail });
  if (i.tech === "nextjs" || i.tech === "next-postgres" || i.tech === "next-supabase")
    add("nextjs", "Next.js", "Next.js is a multi-file App Router project with a server runtime; v0 is built around that structure.");
  if (i.tech === "next-postgres" || i.backend === "database")
    add("postgres", "Postgres", "Postgres access needs server-side code, migrations and credentials that a client-side preview cannot hold.");
  if (i.tech === "next-supabase")
    add("supabase", "Supabase", "Supabase needs SSR clients, session refresh, Auth configuration and Row Level Security.");
  if (i.persistence === "database" || i.persistence === "storage" || i.persistence === "realtime" || i.persistence === "multi-tenant")
    add("persistent-records", "Persistent records", "Records that must survive a reload need a database or storage layer, not artifact-local state.");
  if (i.backend === "auth-secrets" || i.persistence === "auth" || i.persistence === "multi-tenant")
    add("authentication", "Authentication", "Authentication needs real sessions, cookies and server-side user validation.");
  if (i.backend === "server-api")
    add("server-api", "Server APIs / webhooks", "Route handlers, server actions and webhooks need a runtime that can host server code.");
  if (i.backend === "auth-secrets")
    add("private-secrets", "Private server secrets", "Private secrets must stay server-side and can never be shipped into an artifact or Canvas preview.");
  if (i.interaction === "multi-user")
    add("multi-user", "Multi-user collaboration", "Shared editing needs server-held state and conflict handling.");
  if (i.persistence === "multi-tenant") {
    add("organization-membership", "Organization / workspace membership", "Tenancy needs organizations and memberships enforced in the database.");
    add("role-based-access", "Role-based access", "Owner/admin/member/viewer roles must be enforced server-side, not by hiding UI.");
    add("row-level-security", "Row Level Security", "Tenant isolation belongs in RLS policies on every exposed table.");
  }
  if (i.handoff === "github")
    add("github", "GitHub-backed deployment", "A repository-based workflow needs a real project to commit.");
  if (i.handoff === "vercel")
    add("vercel", "Vercel deployment", "Vercel deploys a project, not a pasted file.");
  if (i.deliverable === "full-stack-feature")
    add("full-stack-feature", "Full-stack feature", "A full-stack feature spans routes, data and UI in one project.");
  return t;
}

export type EscalationLevel = "none" | "required";
export type Escalation = { level: EscalationLevel; warning: string | null; checklist: string[] };

export type HandoffStep = { step: number; platform: PlatformId | "github" | "vercel"; action: string };

export type Recommendation = {
  inputs: RouterInputs;
  primary: PlatformId;
  secondary: PlatformId;
  confidence: number;
  forcedByV0Rules: boolean;
  triggers: Trigger[];
  scores: Scores;
  reasons: string[];
  limitations: string[];
  bestInitialOutput: string;
  bestExportFormat: string;
  escalation: Escalation;
  handoffSteps: HandoffStep[];
};

const RULESETS: Array<[keyof RouterInputs, Record<string, Rule>]> = [
  ["deliverable", DELIVERABLE_RULES],
  ["interaction", INTERACTION_RULES],
  ["backend", BACKEND_RULES],
  ["tech", TECH_RULES],
  ["persistence", PERSISTENCE_RULES],
  ["handoff", HANDOFF_RULES],
];

export function scorePlatforms(i: RouterInputs): { scores: Scores; reasonsByPlatform: Record<PlatformId, string[]> } {
  const scores = s(0, 0, 0);
  const reasonsByPlatform: Record<PlatformId, string[]> = { "claude-artifacts": [], "chatgpt-canvas": [], v0: [] };
  for (const [key, table] of RULESETS) {
    const rule = table[i[key]];
    if (!rule) continue;
    const best = Math.max(...PLATFORM_IDS.map((p) => rule.scores[p]));
    for (const p of PLATFORM_IDS) {
      scores[p] += rule.scores[p];
      if (best > 0 && rule.scores[p] === best) reasonsByPlatform[p].push(rule.why);
    }
  }
  return { scores, reasonsByPlatform };
}

const EXPORT_BY_PLATFORM: Record<PlatformId, (i: RouterInputs) => { initial: string; export: string }> = {
  "claude-artifacts": (i) => {
    if (i.deliverable === "diagram")
      return { initial: "Mermaid or SVG rendered in the artifact", export: "Mermaid (.mmd) / SVG source committed under /docs" };
    if (i.deliverable === "marketing-page")
      return { initial: "Single-file HTML page", export: "HTML source, moved to a Next.js or static-site repository for launch" };
    if (i.backend === "file-export")
      return { initial: "Single-file React or HTML artifact", export: "Client-side CSV / JSON / Markdown download plus JSX source" };
    return { initial: "Single-file React or HTML artifact", export: "JSX / HTML source copied to GitHub; JSON or CSV for data" };
  },
  "chatgpt-canvas": (i) => {
    if (i.deliverable === "data-analysis")
      return { initial: "Python script run in the Canvas console", export: ".py script + summary CSV + Markdown report" };
    if (i.deliverable === "presentation")
      return { initial: "Slide-by-slide outline with speaker notes", export: "Markdown for the repository; DOCX/PDF for stakeholders" };
    return { initial: "Revisable document in Canvas", export: "Markdown for the repository; DOCX or PDF for stakeholders" };
  },
  v0: () => ({
    initial: "Multi-file Next.js project in the v0 sandbox",
    export: "GitHub repository (Next.js project) → Vercel preview deployment",
  }),
};

function buildEscalation(primary: PlatformId, triggers: Trigger[]): Escalation {
  if (primary !== "v0") return { level: "none", warning: null, checklist: [] };
  const uses = triggers.map((t) => t.label).join(", ");
  return {
    level: "required",
    warning:
      `A v0 sandbox preview is not a production deployment${uses ? ` (selected: ${uses})` : ""}. ` +
      "Before production, require real input validation, database migrations, Row Level Security, automated tests and validated environment variables.",
    checklist: [
      "Commit the generated project to GitHub; review every file in a pull request",
      "Write and apply database migrations; never rely on dashboard-only schema edits",
      "Enable Row Level Security on every exposed table and test it with two different users",
      "Validate every request body server-side (e.g. Zod); never trust client-side checks",
      "Verify authentication server-side with supabase.auth.getUser(), not getSession()",
      "Keep secrets in server-only environment variables; only NEXT_PUBLIC_* values reach the browser",
      "Add unit and integration tests, lint, typecheck and a production build to CI",
      "Pin dependencies and run the production build in the target repository",
      "Create a Vercel preview deployment and verify auth redirects against its real URL",
    ],
  };
}

function buildHandoff(primary: PlatformId, secondary: PlatformId, i: RouterInputs, forced: boolean): HandoffStep[] {
  if (primary === "v0") {
    const prototypeFirst = forced && PLATFORMS[secondary].id === "claude-artifacts" && i.deliverable !== "full-stack-feature";
    const steps: HandoffStep[] = [];
    if (prototypeFirst)
      steps.push({ step: 1, platform: "claude-artifacts", action: "Optional: prototype the UI and data shape as a Claude Artifact with sample data. This is a design aid, not the implementation." });
    steps.push(
      { step: steps.length + 1, platform: "github", action: "Create the repository, add docs/ and supabase/migrations/, and protect main." },
      { step: steps.length + 2, platform: "v0", action: "Import or connect the repository in v0 and generate the Next.js implementation on a feature branch." },
      { step: steps.length + 3, platform: "github", action: "Review the diff in a pull request; run lint, typecheck, tests and the production build." },
      { step: steps.length + 4, platform: "vercel", action: "Deploy a preview, set environment variables, verify auth redirects, then promote to production." },
    );
    return steps;
  }
  if (primary === "chatgpt-canvas")
    return [
      { step: 1, platform: "chatgpt-canvas", action: "Draft, revise and (for data work) run the Python in Canvas." },
      { step: 2, platform: "chatgpt-canvas", action: "Export the document or source file in the target format." },
      { step: 3, platform: "github", action: "Commit the Markdown/source to the repository so it is reviewable." },
    ];
  return [
    { step: 1, platform: "claude-artifacts", action: "Generate the artifact from the canonical prompt and iterate on it." },
    { step: 2, platform: "claude-artifacts", action: "Export the source (JSX/HTML/SVG/Mermaid) or the client-side download." },
    { step: 3, platform: "github", action: "Commit the source to the repository; move to a real project if it later needs persistence or auth." },
  ];
}

export function recommend(inputs: RouterInputs): Recommendation {
  const triggers = v0Triggers(inputs);
  const forced = triggers.length > 0;
  const { scores, reasonsByPlatform } = scorePlatforms(inputs);

  const deliverableScores = DELIVERABLE_RULES[inputs.deliverable].scores;
  const nonV0 = PLATFORM_IDS.filter((p) => p !== "v0");
  const rank = (a: PlatformId, b: PlatformId) =>
    scores[b] - scores[a] || deliverableScores[b] - deliverableScores[a] || PLATFORM_IDS.indexOf(a) - PLATFORM_IDS.indexOf(b);

  let primary: PlatformId;
  let secondary: PlatformId;
  if (forced) {
    primary = "v0";
    secondary = [...nonV0].sort(rank)[0]!;
  } else {
    const ordered = [...PLATFORM_IDS].sort(rank);
    primary = ordered[0]!;
    secondary = ordered[1]!;
  }

  let confidence: number;
  if (forced) {
    const conflict = ["document", "presentation", "data-analysis"].includes(inputs.deliverable) ? 12 : 0;
    confidence = Math.min(97, 80 + 4 * (triggers.length - 1)) - conflict;
  } else {
    const top = scores[primary];
    const second = scores[secondary];
    confidence = Math.round(50 + (50 * (top - second)) / Math.max(top, 1));
    confidence = Math.max(52, Math.min(95, confidence));
  }

  const reasons = forced
    ? triggers.map((t) => `${t.label}: ${t.detail}`)
    : reasonsByPlatform[primary].slice(0, 5);
  if (forced && inputs.deliverable !== "full-stack-feature") {
    const note = DELIVERABLE_RULES[inputs.deliverable].why;
    if (DELIVERABLE_RULES[inputs.deliverable].scores[secondary] > 3) reasons.push(`Secondary (${PLATFORMS[secondary].name}): ${note}`);
  }

  const limitations = [PLATFORMS[primary].sandboxLimits, ...PLATFORMS[primary].boundaries];
  const out = EXPORT_BY_PLATFORM[primary](inputs);

  return {
    inputs,
    primary,
    secondary,
    confidence,
    forcedByV0Rules: forced,
    triggers,
    scores,
    reasons,
    limitations,
    bestInitialOutput: out.initial,
    bestExportFormat: out.export,
    escalation: buildEscalation(primary, triggers),
    handoffSteps: buildHandoff(primary, secondary, inputs, forced),
  };
}

/** Whether the Supabase implementation prompt applies to this selection. */
export function needsSupabasePrompt(i: RouterInputs): boolean {
  return (
    i.tech === "next-supabase" ||
    i.persistence === "auth" ||
    i.persistence === "storage" ||
    i.persistence === "realtime" ||
    i.persistence === "multi-tenant"
  );
}
