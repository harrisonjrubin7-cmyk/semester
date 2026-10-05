/** Ready-to-copy prompts generated from a recommendation. */
import { needsSupabasePrompt, type Recommendation } from "./engine";
import { labelFor } from "./inputs";
import { PLATFORMS } from "./platforms";

function selectionLines(r: Recommendation): string {
  const i = r.inputs;
  return [
    `- Deliverable: ${labelFor("deliverable", i.deliverable)}`,
    `- Interaction: ${labelFor("interaction", i.interaction)}`,
    `- Backend: ${labelFor("backend", i.backend)}`,
    `- Technology target: ${labelFor("tech", i.tech)}`,
    `- Persistence / access: ${labelFor("persistence", i.persistence)}`,
    `- Handoff: ${labelFor("handoff", i.handoff)}`,
  ].join("\n");
}

export function buildPrompt(r: Recommendation, task?: string): string {
  const platform = PLATFORMS[r.primary];
  const goal = task?.trim() || `[Describe the ${labelFor("deliverable", r.inputs.deliverable).toLowerCase()} you want built]`;
  const header = `You are working in ${platform.name}.\n\nTask:\n${goal}\n\nSelections:\n${selectionLines(r)}\n`;

  if (r.primary === "v0") {
    return (
      header +
      `
Build this as a real multi-file Next.js App Router project (TypeScript strict mode, Tailwind CSS).

Requirements:
- Route handlers / server actions for every mutation; validate every input with Zod on the server.
- Use Supabase Postgres with migrations in supabase/migrations/ and Row Level Security on every exposed table.
- Authenticate server-side with supabase.auth.getUser(); never trust client-side checks for authorization.
- Read configuration from NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Never expose a service-role key to the browser.
- Include loading, empty, error and success states, accessible keyboard navigation and semantic labels.
- Include unit tests, a README with setup steps, and a .env.example.

Output: a runnable project with a file manifest. State clearly anything you did not implement or could not verify.
`
    );
  }
  if (r.primary === "chatgpt-canvas") {
    return (
      header +
      `
Create this in Canvas as a revisable ${r.inputs.deliverable === "data-analysis" ? "Python script" : "document"}.

Requirements:
- Structure it with clear headings so sections can be revised independently.
- State assumptions and open questions explicitly rather than inventing facts.
${r.inputs.deliverable === "data-analysis" ? "- Read the CSV with the standard library or pandas, compute the requested metrics, write a summary CSV and a short Markdown report.\n" : ""}- Keep the result exportable as ${r.bestExportFormat}.
- Do not add anything that requires a server, database, authentication or secrets; flag those as handoff items.
`
    );
  }
  return (
    header +
    `
Create this as a single self-contained Claude Artifact.

Requirements:
- ${r.inputs.deliverable === "diagram" ? "Render a Mermaid or SVG diagram with a legend." : "One file, local React state or plain JavaScript, realistic sample data."}
- Load libraries only from approved CDNs (cdnjs, jsDelivr, Tailwind CDN, unpkg).
- Accessible keyboard controls and semantic labels; responsive layout.
- Offer client-side downloads (${r.inputs.backend === "file-export" ? "CSV / JSON / Markdown" : "JSON or Markdown"}) where useful.
- Do not simulate a backend, authentication or persistent storage. List anything that needs one as a handoff item.
`
  );
}

export function githubPlan(r: Recommendation): string {
  const lines = ["# GitHub handoff plan", ""];
  r.handoffSteps.forEach((s) => lines.push(`${s.step}. [${s.platform}] ${s.action}`));
  lines.push(
    "",
    "Repository layout:",
    "```text",
    "docs/                    PRDs, Mermaid diagrams, decisions",
    "app/                     Next.js App Router routes",
    "components/              UI components",
    "lib/                     domain logic, Supabase clients, validation",
    "supabase/migrations/     versioned SQL (source of truth for the schema)",
    ".github/workflows/ci.yml typecheck, lint, test, build",
    "```",
    "",
    "Branch and review:",
    "- Work on a feature branch; open a draft pull request early.",
    "- Require typecheck, lint, tests and a production build to pass before merge.",
    "- Never commit .env files or any service-role key.",
  );
  if (r.primary === "v0") {
    lines.push("", "Vercel:", "- Import the repository, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY per environment.", "- Add the preview and production URLs to Supabase Auth redirect URLs.");
  }
  return lines.join("\n");
}

export function supabasePrompt(r: Recommendation): string | null {
  if (!needsSupabasePrompt(r.inputs)) return null;
  const tenant = r.inputs.persistence === "multi-tenant";
  return `Implement Supabase for a Next.js App Router application.

Clients (use @supabase/ssr):
- lib/supabase/client.ts: createBrowserClient for Client Components.
- lib/supabase/server.ts: createServerClient with the cookies() store for Server Components, Server Actions and Route Handlers.
- lib/supabase/middleware.ts: updateSession() that refreshes the session cookies; call it from proxy.ts (Next.js 16) or middleware.ts (Next.js 15 and earlier).

Environment variables:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- Never expose a service-role or secret key to the browser or to any NEXT_PUBLIC_* variable.

Auth:
- Magic-link or email/password sign-in, /auth/confirm route that calls verifyOtp, and a POST sign-out route.
- Validate the user on the server with supabase.auth.getUser() before every protected read or write.
${
  tenant
    ? `
Tenancy:
- Tables: organizations, organization_members (roles: owner, admin, member, viewer).
- Every tenant-owned table carries organization_id.
- RLS: members read their organization's rows; owner/admin/member write; viewer is read-only; only owner/admin manage members.
- Authorization lives in RLS and server code, never in hidden buttons.
`
    : ""
}
Database:
- Put all schema in supabase/migrations/*.sql. Enable Row Level Security on every table in an exposed schema.
- Write explicit policies per operation (select, insert, update, delete) and test them with two different users.
- Add indexes on every foreign key used in a policy.

Validation and tests:
- Validate all server inputs with Zod.
- Add tests for RLS (another user's rows are invisible), for the session helper, and for input validation.
`;
}
