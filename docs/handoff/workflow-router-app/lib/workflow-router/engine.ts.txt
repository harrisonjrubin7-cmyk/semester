import type { Platform } from '../benchmark/benchmark.config';
import type { RouterAnswers } from '../validation/workflow-router';

export interface Recommendation { primary: Platform; secondary: Platform; confidence: number; scores: Record<Platform, number>; reasons: Record<Platform, string[]>; escalation: boolean; escalationReasons: string[]; limitations: string[]; handoffFormat: string; forcedV0: boolean }

/** Selections that must route to v0: anything needing a server, persistence, auth, multi-user, or deployment. */
export function v0Triggers(a: RouterAnswers): string[] {
  const t: string[] = [];
  if (a.technology === 'nextjs' || a.technology === 'nextjs-postgres' || a.technology === 'nextjs-supabase') t.push('Next.js target');
  if (a.technology === 'nextjs-postgres') t.push('Postgres');
  if (a.technology === 'nextjs-supabase') t.push('Supabase / Auth');
  if (a.backend === 'database') t.push('Persistent records');
  if (a.backend === 'server-api') t.push('Server-side APIs or webhooks');
  if (a.backend === 'auth-secrets') t.push('Authentication and private server secrets');
  if (a.persistence === 'database' || a.persistence === 'storage') t.push('Persistent records');
  if (a.persistence === 'auth') t.push('Authentication');
  if (a.persistence === 'realtime') t.push('Realtime / multi-user');
  if (a.persistence === 'multi-tenant') t.push('Organization workspace, roles and Row Level Security');
  if (a.interaction === 'multi-user') t.push('Multi-user collaboration');
  if (a.deliverable === 'full-stack') t.push('Full-stack feature');
  if (a.handoff === 'github') t.push('GitHub-backed deployment');
  if (a.handoff === 'vercel') t.push('Vercel deployment');
  return [...new Set(t)];
}

export function recommend(a: RouterAnswers): Recommendation {
  const s: Record<Platform, number> = { 'claude-artifacts': 0, 'chatgpt-canvas': 0, v0: 0 };
  const r: Record<Platform, string[]> = { 'claude-artifacts': [], 'chatgpt-canvas': [], v0: [] };
  const add = (p: Platform, n: number, why: string) => { s[p] += n; r[p].push(why); };

  switch (a.deliverable) {
    case 'interactive-tool': add('claude-artifacts', 4, 'Self-contained interactive tools are the Artifacts sweet spot'); add('v0', 1, 'v0 can host the tool if it later needs a backend'); break;
    case 'prototype': add('claude-artifacts', 4, 'Fast shareable prototypes render beside the chat'); add('v0', 2, 'v0 prototypes become real projects'); break;
    case 'marketing-page': add('claude-artifacts', 3, 'Single-page HTML is portable'); add('v0', 3, 'v0 ships Next.js marketing pages to Vercel'); break;
    case 'diagram': add('claude-artifacts', 5, 'Mermaid/SVG diagrams render natively'); add('chatgpt-canvas', 1, 'Canvas can iterate diagram source text'); break;
    case 'document': add('chatgpt-canvas', 5, 'Revision-centred writing with PDF/DOCX/Markdown export'); add('claude-artifacts', 2, 'Markdown documents render as artifacts'); break;
    case 'presentation': add('chatgpt-canvas', 3, 'Iterate slide copy and outline'); add('claude-artifacts', 3, 'HTML slide decks render and share'); break;
    case 'data-analysis': add('chatgpt-canvas', 5, 'Canvas runs Python for data analysis'); add('claude-artifacts', 1, 'Client-side charts for a finished dataset'); break;
    case 'react-component': add('claude-artifacts', 3, 'Single-component React renders in Artifacts'); add('v0', 3, 'v0 places components in a real project'); add('chatgpt-canvas', 2, 'Canvas iterates component code'); break;
    case 'full-stack': add('v0', 6, 'Multi-file Next.js with server routes'); break;
  }
  switch (a.interaction) {
    case 'none': add('chatgpt-canvas', 1, 'No interaction needed'); break;
    case 'simple-local': add('claude-artifacts', 2, 'Simple local state is fine in an artifact'); break;
    case 'complex-local': add('claude-artifacts', 2, 'Complex client state in one React file'); add('v0', 1, 'Complex state may outgrow one file'); break;
    case 'multi-user': add('v0', 5, 'Multi-user needs a server and database'); break;
  }
  if (a.backend === 'file-export') { add('claude-artifacts', 2, 'Browser-generated CSV/PNG/Markdown downloads'); add('chatgpt-canvas', 2, 'Document/source-file export'); }
  if (['database', 'server-api', 'auth-secrets'].includes(a.backend)) add('v0', 5, 'Server code, API routes and database connections run in v0');
  if (a.technology === 'html') add('claude-artifacts', 2, 'Plain HTML/CSS/JS is portable');
  if (a.technology === 'react') { add('claude-artifacts', 1, 'React via approved CDNs'); add('v0', 1, 'Native React project'); }
  if (a.technology.startsWith('nextjs')) add('v0', 5, 'Next.js App Router is v0’s native target');
  if (a.persistence === 'none') add('claude-artifacts', 1, 'No persistence required');
  if (a.handoff === 'share') add('claude-artifacts', 2, 'Share a published artifact immediately');
  if (a.handoff === 'document-export') add('chatgpt-canvas', 2, 'PDF/DOCX/Markdown export');
  if (a.handoff === 'github' || a.handoff === 'vercel') add('v0', 4, 'GitHub sync and Vercel deployment');

  const triggers = v0Triggers(a);
  const forcedV0 = triggers.length > 0;
  if (forcedV0) add('v0', 10, 'Required for: ' + triggers.join(', '));

  const order = (Object.keys(s) as Platform[]).sort((x, y) => s[y] - s[x]);
  let [primary, secondary] = order;
  if (forcedV0 && primary !== 'v0') { secondary = primary; primary = 'v0'; }
  const total = Object.values(s).reduce((a2, b) => a2 + b, 0) || 1;
  const margin = (s[primary] - s[secondary]) / total;
  const confidence = Math.min(0.97, Math.round((0.55 + margin) * 100) / 100);

  const escalationReasons = [...triggers];
  if (primary !== 'v0' && (a.persistence !== 'none')) escalationReasons.push('Persistence selected: artifact/canvas state is not durable storage');
  const limitations = {
    'claude-artifacts': ['No durable backend, secret store or production auth', 'Libraries only from approved CDNs', 'localStorage/fetch may be restricted in the sandbox'],
    'chatgpt-canvas': ['Not a production backend or deployment target', 'React/HTML preview runs in an isolated sandbox'],
    v0: ['Generated code still needs migrations, RLS, tests and environment variables before production', 'Sandbox is isolated; production secrets live in Vercel/Supabase'],
  }[primary];
  const handoffFormat = { 'claude-artifacts': 'Single-file HTML or React/JSX, Mermaid/SVG, browser CSV/PNG download', 'chatgpt-canvas': 'PDF, DOCX or Markdown; code as .py/.ts/.sql', v0: 'Next.js project → GitHub repository → Vercel deployment' }[primary];
  return { primary, secondary, confidence, scores: s, reasons: r, escalation: escalationReasons.length > 0, escalationReasons, limitations, handoffFormat, forcedV0 };
}
