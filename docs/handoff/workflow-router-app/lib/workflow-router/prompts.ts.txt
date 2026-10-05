import { PLATFORM_LABEL } from '../benchmark/benchmark.config';
import type { Recommendation } from './engine';
import type { RouterAnswers } from '../validation/workflow-router';
export function buildPrompt(a: RouterAnswers, r: Recommendation): string {
  const head = 'You are building a Semester ' + a.deliverable.replace('-', ' ') + ' in ' + PLATFORM_LABEL[r.primary] + '.';
  const rules = r.primary === 'v0'
    ? ['Next.js App Router, TypeScript strict, Tailwind.', 'Supabase via @supabase/ssr: lib/supabase/client.ts, server.ts, middleware session refresh.', 'Validate every mutation with Zod on the server; call supabase.auth.getUser() server-side.', 'Write SQL migrations with RLS on every exposed table; never expose a service-role key.', 'Add tests and .env.example; do not call it production-ready until migrations, RLS and tests pass.']
    : r.primary === 'chatgpt-canvas'
      ? ['Work as a revisable document/code canvas.', 'Use clear sections and export to Markdown/DOCX/PDF (or the code file type).', 'State assumptions and sources.']
      : ['Single self-contained file (HTML or one React component).', 'Libraries only from approved CDNs; no secrets, no fetch to private APIs.', 'Treat state as local preview only; provide CSV/Markdown download if data must leave.'];
  return [head, '', 'Requirements: interaction=' + a.interaction + ', backend=' + a.backend + ', tech=' + a.technology + ', persistence=' + a.persistence + ', handoff=' + a.handoff + '.', '', ...rules.map((x) => '- ' + x), '', 'Use Semester tokens: Ink chrome, Parchment content, Semester blue for action, glyph + word + tone for every status, and label every fact with its source.'].join('\n');
}
export function githubPlan(r: Recommendation): string[] {
  return r.primary === 'v0' ? ['Create repo from v0 → GitHub', 'Protect main; PRs require typecheck, lint, test, build', 'Add Supabase env vars in Vercel (never the service role in NEXT_PUBLIC_*)', 'Run migrations via supabase db push in CI', 'Preview deployments per PR']
    : ['Export the source (' + r.handoffFormat + ')', 'Commit to docs/ or prototypes/ in the Semester repo', 'Open a PR linking the artifact URL', 'Escalate to v0 if persistence/auth is later required'];
}
export function supabasePrompt(): string {
  return 'Add Supabase to this Next.js app: @supabase/ssr browser/server clients, middleware session refresh, magic-link auth with /auth/confirm, migrations for organizations, organization_members (owner/admin/member/viewer), and the feature tables with RLS scoped to auth.uid() and org membership. Use NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY only.';
}
