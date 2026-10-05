import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cell, controlLine, renderedFrom, table } from '../ops/render';
import {
  ADMISSION_RULE, AS_OF, CAPABILITY_REGISTER, DEFINITION_OF_DONE, MASTER_PLAN_TITLE,
  MILESTONES, NOT_NOW, THIRTY_DAY_PLAN, VISION, stateCounts,
} from './master-plan';

const root = join(import.meta.dirname, '../../../..');
const DOC = 'docs/SEMESTER-MASTER-PLAN.md';
const STATUS_MAP = 'docs/PRODUCT-STATUS-MAP.md';
const DASHBOARD = 'ops/master-plan/index.html';
const statusLabel = (value: string) => value.replaceAll('-', ' ');
const esc = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function markdown(): string {
  const counts = stateCounts();
  const lines = [
    renderedFrom('app/src/lib/governance/master-plan.ts', 'master-plan.test.ts'), '',
    `# ${MASTER_PLAN_TITLE}`, '', controlLine(DOC), '',
    `**As of ${AS_OF}.** This is an execution control document, not a launch claim. Product maturity, tenant activation, deployment, pilot completion, and institutional approval are separate states.`, '',
    '## Vision', '', ...VISION.map((line) => `- ${line}`), '',
    '## One definition of done', '', ...DEFINITION_OF_DONE.map((item) => `- [ ] ${item}.`), '',
    '## Milestone roadmap', '',
    ...table(['Milestone', 'Scope', 'Current state', 'Proof of completion', 'Next gate'], MILESTONES.map((m) => [
      `${m.id}: ${cell(m.name)}`, cell(m.scope), statusLabel(m.status), cell(m.proof), cell(m.nextGate),
    ])), '',
    '## Capability register', '',
    `${CAPABILITY_REGISTER.length} catalog capabilities: **${counts.verified} verified**, **${counts.partial} partial**, **${counts.blocked} blocked**, **${counts.absent} absent**, **${counts.conflict} conflict**. “Verified” is the source registry's product status; it is not production or tenant activation evidence.`, '',
    ...table(['ID', 'Capability', 'Owner', 'Status', 'Risk', 'Activation', 'Dependencies', 'Evidence class', 'Review'], CAPABILITY_REGISTER.map((c) => [
      c.id, cell(c.name), cell(c.owner), c.currentState, c.riskTier, c.activation,
      c.dependencies.length ? cell(c.dependencies.join('; ')) : '—', c.evidenceClass, c.reviewDate,
    ])), '',
    '## 30-day M1/M2 execution program', '',
    ...THIRTY_DAY_PLAN.flatMap((week) => [`### Week ${week.week}: ${week.objective}`, '', ...week.deliverables.map((item) => `- ${item}`), '', `**Exit evidence:** ${week.exitEvidence}`, '']),
    '## Not now', '', ...NOT_NOW.map((item) => `- ${item}`), '',
    'These are sequenced, not rejected. Their primitives and activation contracts may be designed, but operational implementation waits for evidence, a design partner, specialist ownership, and funded scope.', '',
    '## Admission rule', '', `> ${ADMISSION_RULE}`, '', 'If the answer is none of the three, do not build it yet.', '',
    '## Evidence and operating links', '',
    '- [Product Status Map](PRODUCT-STATUS-MAP.md)',
    '- [L9 Capability Readiness](L9-CAPABILITY-READINESS.md)',
    '- [Master Launch Readiness Register](MASTER-LAUNCH-READINESS-REGISTER.md)',
    '- [Evidence Register](EVIDENCE-REGISTER.md)',
    '- [Trust Evidence Register](trust/EVIDENCE-REGISTER.md)',
    '- [Milestones 1 and 2 evidence](MILESTONE-1-2-EVIDENCE.md)',
    '- [M1/M2 automated verification — 30 September 2026](evidence/m1-m2/2026-09-30-automated-verification.md)',
    '- [Roadmap audit](ROADMAP-AUDIT.md)',
    '- [Product implementation status](IMPLEMENTATION_STATUS.md)',
    '- [Interactive dashboard](../ops/master-plan/index.html)', '',
  ];
  return lines.join('\n').replace(/\n+$/, '\n');
}

function productStatusMap(): string {
  const counts = stateCounts();
  const source = (value: string): string => {
    if (!value.startsWith('repo:')) return cell(value);
    const path = value.slice('repo:'.length);
    return `[\`${cell(path)}\`](../${path})`;
  };
  return [
    renderedFrom('app/src/lib/governance/master-plan.ts', 'master-plan.test.ts'), '',
    '# Product Status Map', '', controlLine(STATUS_MAP), '',
    `**Snapshot date: ${AS_OF}.** This map reports repository catalog state. It does not prove a deployment, a tenant activation, a successful pilot, an institutional approval, or a production control.`, '',
    `There are **${CAPABILITY_REGISTER.length} capabilities**: ${counts.verified} verified, ${counts.partial} partial, ${counts.blocked} blocked, ${counts.absent} absent, and ${counts.conflict} in conflict.`, '',
    '## Status meanings', '',
    '- **Verified:** the canonical source registry marks the bounded product promise verified. The cited source is still not deployment evidence.',
    '- **Partial:** a useful slice exists, but the stated promise or operating boundary remains incomplete.',
    '- **Blocked:** an external credential, approval, authoritative source, or operational dependency prevents completion.',
    '- **Absent:** the capability has no implementation evidence in the canonical registry.',
    '- **Conflict:** repository evidence disagrees and must be reconciled before a claim is made.',
    '- **Activation:** every capability still requires an explicit tenant decision; controlled and high-risk capabilities are not approved.', '',
    '## Capability truth', '',
    ...table(
      ['ID', 'Product promise', 'State', 'Disposition', 'Risk', 'Activation', 'Owner', 'Evidence pointers', 'Completion check'],
      CAPABILITY_REGISTER.map((capability) => [
        capability.id,
        `${cell(capability.name)} — ${cell(capability.promise)}`,
        capability.currentState,
        capability.disposition,
        capability.riskTier,
        capability.activation,
        cell(capability.owner),
        capability.sources.map(source).join('<br>'),
        cell(capability.acceptance.join('; ')),
      ]),
    ), '',
    '## Claim ceiling', '',
    'A public or institutional claim may never exceed the lowest of product state, evidence freshness, tenant activation, deployment verification, and operating approval. “Verified” in this map therefore permits a bounded product statement only; it does not permit “live,” “institution-ready,” or “system of record.”', '',
  ].join('\n').replace(/\n+$/, '\n');
}

function dashboard(): string {
  const counts = stateCounts();
  const milestoneCards = MILESTONES.map((m) => `<article class="card" data-status="${m.status}"><div class="eyebrow">${m.id} · ${esc(statusLabel(m.status))}</div><h2>${esc(m.name)}</h2><p>${esc(m.scope)}</p><details><summary>Proof and next gate</summary><p><strong>Proof:</strong> ${esc(m.proof)}</p><p><strong>Next:</strong> ${esc(m.nextGate)}</p></details></article>`).join('');
  const capabilityRows = CAPABILITY_REGISTER.map((c) => `<tr data-state="${c.currentState}" data-risk="${c.riskTier}"><td>${c.id}</td><td><strong>${esc(c.name)}</strong><small>${esc(c.promise)}</small></td><td>${esc(c.owner)}</td><td><span class="pill ${c.currentState}">${c.currentState}</span></td><td><span class="pill ${c.riskTier}">${c.riskTier}</span></td><td>${c.activation}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(MASTER_PLAN_TITLE)}</title><style>
:root{color-scheme:dark;--bg:#090b0f;--panel:#121722;--line:#293142;--ink:#f5f3eb;--muted:#aab3c2;--accent:#bbff5e;--warn:#ffcc66;--danger:#ff7a90}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 85% 0,#18283a 0,transparent 34%),var(--bg);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui}main{max-width:1280px;margin:auto;padding:48px 24px 80px}.kicker,.eyebrow{font:700 12px/1.2 ui-monospace,monospace;letter-spacing:.13em;text-transform:uppercase;color:var(--accent)}h1{font-size:clamp(36px,7vw,78px);line-height:.96;max-width:1000px;margin:14px 0 24px;letter-spacing:-.045em}h2{margin:.35rem 0}.lede{max-width:760px;color:var(--muted);font-size:18px}.stats,.grid{display:grid;gap:14px}.stats{grid-template-columns:repeat(5,minmax(0,1fr));margin:34px 0}.stat,.card,.panel{border:1px solid var(--line);background:color-mix(in srgb,var(--panel),transparent 5%);border-radius:16px}.stat{padding:18px}.stat b{display:block;font-size:34px}.grid{grid-template-columns:repeat(auto-fit,minmax(270px,1fr));margin:16px 0 50px}.card{padding:20px}.card p,small{color:var(--muted)}details{border-top:1px solid var(--line);margin-top:14px;padding-top:12px}summary{cursor:pointer;color:var(--accent)}.panel{padding:18px;overflow:auto}label{display:inline-flex;gap:8px;align-items:center;margin:0 14px 14px 0;color:var(--muted)}select,input{background:#0b1018;color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:9px 11px}input{min-width:280px}table{border-collapse:collapse;width:100%;min-width:860px}th,td{text-align:left;border-bottom:1px solid var(--line);padding:12px 10px;vertical-align:top}th{position:sticky;top:0;background:var(--panel);font-size:12px;text-transform:uppercase;letter-spacing:.08em}small{display:block;max-width:560px;margin-top:3px}.pill{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:2px 8px;font:12px ui-monospace,monospace}.verified,.standard{color:var(--accent)}.partial,.controlled,.evidence-required{color:var(--warn)}.blocked,.high-risk{color:var(--danger)}footer{margin-top:34px;color:var(--muted)}@media(max-width:760px){main{padding:28px 14px}.stats{grid-template-columns:repeat(2,1fr)}input{min-width:100%;margin-bottom:10px}}
</style></head><body><main><div class="kicker">Authoritative execution control · ${AS_OF}</div><h1>${esc(MASTER_PLAN_TITLE)}</h1><p class="lede">A finite path from product truth to operating evidence. This dashboard does not convert code, tests, or documents into production activation, pilot completion, or institutional approval.</p><section class="stats"><div class="stat"><b>${CAPABILITY_REGISTER.length}</b>capabilities</div><div class="stat"><b>${counts.verified}</b>verified</div><div class="stat"><b>${counts.partial}</b>partial</div><div class="stat"><b>${counts.blocked}</b>blocked</div><div class="stat"><b>${MILESTONES.length}</b>milestones</div></section><div class="kicker">M0—M10 sequence</div><section class="grid">${milestoneCards}</section><div class="kicker">Capability register</div><h2>Product truth, risk, and activation are separate</h2><div class="panel"><label>Search <input id="q" type="search" placeholder="Capability, owner, or ID"></label><label>Status <select id="state"><option value="">All</option><option>verified</option><option>partial</option><option>blocked</option><option>absent</option><option>conflict</option></select></label><label>Risk <select id="risk"><option value="">All</option><option>standard</option><option>controlled</option><option>high-risk</option></select></label><table><thead><tr><th>ID</th><th>Capability</th><th>Owner</th><th>Status</th><th>Risk</th><th>Activation</th></tr></thead><tbody id="rows">${capabilityRows}</tbody></table></div><footer><strong>Admission rule:</strong> ${esc(ADMISSION_RULE)} If none, do not build it yet. Generated from <code>master-plan.ts</code>; run <code>npm run registers</code> to refresh.</footer></main><script>const q=document.querySelector('#q'),s=document.querySelector('#state'),r=document.querySelector('#risk'),rows=[...document.querySelectorAll('#rows tr')];function filter(){const text=q.value.toLowerCase();for(const row of rows)row.hidden=!(row.textContent.toLowerCase().includes(text)&&(!s.value||row.dataset.state===s.value)&&(!r.value||row.dataset.risk===r.value))}[q,s,r].forEach(x=>x.addEventListener('input',filter));</script></body></html>\n`;
}

describe('Semester master plan', () => {
  it('defines one complete definition of done', () => {
    expect(DEFINITION_OF_DONE).toHaveLength(14);
    expect(new Set(DEFINITION_OF_DONE).size).toBe(14);
  });

  it('sequences M0 through M10 without pretending a milestone is complete', () => {
    expect(MILESTONES.map((m) => m.id)).toEqual(Array.from({ length: 11 }, (_, i) => `M${i}`));
    for (const [index, milestone] of MILESTONES.entries()) {
      expect(milestone.proof.length, milestone.id).toBeGreaterThan(30);
      expect(milestone.nextGate.length, milestone.id).toBeGreaterThan(30);
      for (const dependency of milestone.dependsOn) expect(Number(dependency.slice(1))).toBeLessThan(index);
    }
  });

  it('registers every source capability once with risk and activation kept separate', () => {
    expect(CAPABILITY_REGISTER).toHaveLength(60);
    expect(new Set(CAPABILITY_REGISTER.map((c) => c.id)).size).toBe(60);
    expect(CAPABILITY_REGISTER.find((c) => c.id === 'CAP-050')?.riskTier).toBe('high-risk');
    expect(CAPABILITY_REGISTER.filter((c) => c.riskTier === 'high-risk').every((c) => c.activation === 'not-approved')).toBe(true);
  });

  it('keeps the 30-day program on M1 and M2 and the deferral list explicit', () => {
    expect(THIRTY_DAY_PLAN.map((w) => w.week)).toEqual([1, 2, 3, 4]);
    expect(NOT_NOW).toHaveLength(15);
    expect(NOT_NOW).toContain('Official registration writes');
    expect(NOT_NOW).toContain('Autonomous AI writes');
  });

  it('renders the authoritative document and dashboard', () => {
    const outputs = [[DOC, markdown()], [STATUS_MAP, productStatusMap()], [DASHBOARD, dashboard()]] as const;
    for (const [path, content] of outputs) {
      if (process.env.REGISTERS === 'write') writeFileSync(join(root, path), content);
      expect(readFileSync(join(root, path), 'utf8'), `${path} is stale; run npm run registers from app/`).toBe(content);
    }
  });
});
