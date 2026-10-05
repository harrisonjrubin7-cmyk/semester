/**
 * Builds the GTM PDF reports from the Markdown under docs/business.
 *
 *   npm run generate:gtm-pdf              from app/
 *   npm run generate:gtm-pdf -- --check   assemble everything, write nothing
 *
 * The PDFs go to output/ at the repository root; the assembled Markdown source
 * of each goes to docs/business/reports/generated/. Printing uses a headless
 * Chromium/Chrome binary directly (GTM_PDF_CHROME, then SMOKE_CHROME, then the
 * sandbox's /opt/pw-browsers/chromium); no browser automation package is used
 * and nothing is fetched or uploaded. See docs/business/reports/PDF_BUILD.md.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { marked } from 'marked';
import { REPORTS } from './gtm-pdf/manifest.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const OUT = join(root, 'output');
const GEN = join(root, 'docs', 'business', 'reports', 'generated');
const CHECK = process.argv.includes('--check');

// ── Markdown helpers ───────────────────────────────────────────────────────

const read = (rel) => {
  const p = join(root, rel);
  if (!existsSync(p)) throw new Error(`Missing source file: ${rel}`);
  return readFileSync(p, 'utf8');
};

/** Headings outside code fences: [{ i, level, text }]. */
function headings(lines) {
  const out = [];
  let fence = false;
  lines.forEach((line, i) => {
    if (/^```/.test(line)) fence = !fence;
    if (fence) return;
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) out.push({ i, level: m[1].length, text: m[2] });
  });
  return out;
}

const plain = (s) => s.replace(/[*`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** A heading and its subsections, re-levelled to start at `target`. */
function extract(rel, prefix, target = 2) {
  const lines = read(rel).split('\n');
  const hs = headings(lines);
  const at = hs.findIndex((h) => plain(h.text).startsWith(plain(prefix)));
  if (at < 0) throw new Error(`Heading "${prefix}" not found in ${rel}. Was it renamed? Update scripts/gtm-pdf/manifest.mjs.`);
  const start = hs[at];
  const next = hs.slice(at + 1).find((h) => h.level <= start.level);
  const body = lines.slice(start.i, next ? next.i : lines.length);
  const delta = target - start.level;
  const inner = new Set(headings(body).map((h) => h.i));
  return body
    .map((l, i) => (inner.has(i) ? l.replace(/^(#{1,6})/, (m) => '#'.repeat(Math.min(5, Math.max(2, m.length + delta)))) : l))
    .join('\n')
    .trim();
}

function whole(rel, { dropTitle = false } = {}) {
  let text = read(rel);
  const lines = text.split('\n');
  if (dropTitle) {
    const h1 = lines.findIndex((l) => /^# /.test(l));
    if (h1 >= 0) lines.splice(h1, 1);
  }
  // Demote any remaining headings so a section's own H1 does not outrank the report's.
  const hs = new Set(headings(lines).map((h) => h.i));
  return lines.map((l, i) => (hs.has(i) ? l.replace(/^(#{1,6})/, (m) => '#'.repeat(Math.min(5, m.length + 1))) : l)).join('\n').trim();
}

function reviews() {
  const files = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) { if (f !== 'generated') walk(p); } else if (f.endsWith('.md')) files.push(p);
    }
  };
  walk(join(root, 'docs', 'business'));
  const out = [];
  for (const p of files.sort()) {
    const rel = relative(root, p);
    const lines = read(rel).split('\n');
    const hs = headings(lines);
    const at = hs.findIndex((h) => plain(h.text).startsWith('professional review required'));
    if (at < 0) continue;
    const next = hs.slice(at + 1).find((h) => h.level <= hs[at].level);
    const body = lines.slice(hs[at].i + 1, next ? next.i : lines.length).join('\n').trim();
    if (!body) continue;
    const title = (hs.find((h) => h.level === 1)?.text ?? rel).replace(/[*`]/g, '');
    out.push(`### ${title}\n\n${body}`);
  }
  if (out.length === 0) throw new Error('No "Professional review required" sections found.');
  return out.join('\n\n');
}

function partText(part) {
  switch (part.type) {
    case 'md': return part.text;
    case 'file': return whole(part.file, part);
    case 'extract': return extract(part.file, part.heading, part.target ?? 2);
    case 'reviews': return reviews();
    default: throw new Error(`Unknown part type ${part.type}`);
  }
}

/** The Markdown body of a report, and the section list for its contents page. */
function assemble(report) {
  const toc = [];
  const chunks = [];
  report.sections.forEach((s, i) => {
    const body = s.parts.map(partText).join('\n\n');
    if (s.title) {
      const label = report.numbered ? `${i + 1}. ${s.title}` : s.title;
      toc.push(label);
      chunks.push(`# ${label}\n\n${body}`);
    } else {
      chunks.push(body);
    }
  });
  const md = chunks.join('\n\n');
  for (const re of report.forbid ?? []) {
    const m = re.exec(md);
    if (m) throw new Error(`${report.id}: customer-safe report contains forbidden text ${re}: "${md.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\n/g, ' ')}"`);
  }
  return { md, toc };
}

// ── Labels ─────────────────────────────────────────────────────────────────

const LABELS = [
  ['VERIFIED', 'Verified implementation or evidence. Backed by a path in the repository or an evidence id.'],
  ['ASSUMPTION', 'Planning assumption. A number, rate, timing or price chosen to plan with. Not evidenced.'],
  ['DRAFT', 'Draft requiring review. Default for anything new.'],
  ['APPROVED', 'Customer-facing approved claim. Needs a named approver and a register row. None exists today.'],
  ['INTERNAL', 'Internal-only material. Never to be sent to a customer or prospect as written.'],
  ['REVIEW', 'Professional review required: counsel, tax, accounting, insurance, privacy, security, accessibility or procurement.'],
];

/** Count real label tags: `[VERIFIED]` or `[VERIFIED: path]`. Legend mentions in backticks and placeholders such as `[APPROVED PRICE ...]` are not labels on a statement. */
function census(md) {
  const n = (k) => (md.match(new RegExp('(?<!`)\\[' + k + '(?::[^\\]\\n]{0,80})?\\]', 'g')) ?? []).length;
  return { VERIFIED: n('VERIFIED'), ASSUMPTION: n('ASSUMPTION'), DRAFT: n('DRAFT'), APPROVED: n('APPROVED'), INTERNAL: n('INTERNAL'), REVIEW: n('REVIEW'), };
}

const CLASS = { VERIFIED: 'ok', ASSUMPTION: 'assume', DRAFT: 'draft', APPROVED: 'appr', INTERNAL: 'int', REVIEW: 'rev' };

/** Draw label tags as chips, in text only, never inside a tag. */
function chips(html) {
  return html.replace(/>([^<]+)</g, (_, text) =>
    '>' + text.replace(/\[(VERIFIED|ASSUMPTION|DRAFT|APPROVED|INTERNAL|REVIEW)((?::[^\]\n]{0,80})?)\]/g, (__, k, rest) => `<span class="chip ${CLASS[k]}">${k}${rest}</span>`) + '<',
  );
}

// ── HTML ───────────────────────────────────────────────────────────────────

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
@page { size: A4; margin: 18mm 15mm 20mm; @bottom-left { content: var(--foot); font: 7.5pt Helvetica, Arial, sans-serif; color: #5b6472; } @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 7.5pt Helvetica, Arial, sans-serif; color: #5b6472; } }
@page :first { @bottom-left { content: ""; } @bottom-right { content: ""; } }
:root { --ink:#16202e; --dim:#5b6472; --line:#d5dae1; --accent:#1d3a6e; }
* { box-sizing: border-box; }
body { font: 9.2pt/1.45 Georgia, "Times New Roman", serif; color: var(--ink); margin: 0; }
h1, h2, h3, h4, h5 { font-family: Helvetica, Arial, sans-serif; color: var(--accent); line-height: 1.2; break-after: avoid; }
h1 { font-size: 17pt; margin: 0 0 8pt; padding-top: 4pt; border-top: 2.5pt solid var(--accent); break-before: page; }
h1.first { break-before: auto; }
h2 { font-size: 12.5pt; margin: 14pt 0 5pt; }
h3 { font-size: 10.5pt; margin: 11pt 0 4pt; }
h4, h5 { font-size: 9.5pt; margin: 9pt 0 3pt; }
p { margin: 0 0 6pt; } ul, ol { margin: 0 0 6pt; padding-left: 16pt; } li { margin: 1pt 0; }
code { font: 8pt Menlo, Consolas, monospace; background: #eef1f5; padding: 0 2pt; border-radius: 2pt; overflow-wrap: anywhere; }
pre { background: #f3f5f8; border: .5pt solid var(--line); padding: 6pt; font: 7.4pt/1.35 Menlo, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; break-inside: auto; }
pre code { background: none; padding: 0; }
blockquote { margin: 6pt 0; padding: 4pt 8pt; border-left: 2.5pt solid var(--accent); background: #f3f6fb; color: #2a3547; }
table { border-collapse: collapse; width: 100%; margin: 5pt 0 9pt; font: 7.4pt/1.3 Helvetica, Arial, sans-serif; }
th, td { border: .5pt solid var(--line); padding: 2.5pt 4pt; vertical-align: top; text-align: left; overflow-wrap: anywhere; word-break: break-word; }
th { background: #e9edf4; color: #16202e; } thead { display: table-header-group; } tr { break-inside: avoid; }
hr { border: 0; border-top: .5pt solid var(--line); margin: 8pt 0; }
a, .ref { color: var(--accent); text-decoration: none; }
.chip { font: 700 6.4pt Helvetica, Arial, sans-serif; padding: 0 3pt; border-radius: 2pt; border: .5pt solid; white-space: nowrap; display: inline-block; line-height: 1.5; }
.chip.ok { color: #14532d; background: #dcfce7; border-color: #86efac; }
.chip.assume { color: #7c2d12; background: #ffedd5; border-color: #fdba74; }
.chip.draft { color: #1e3a8a; background: #dbeafe; border-color: #93c5fd; }
.chip.appr { color: #134e4a; background: #ccfbf1; border-color: #5eead4; }
.chip.int { color: #4c1d95; background: #ede9fe; border-color: #c4b5fd; }
.chip.rev { color: #7f1d1d; background: #fee2e2; border-color: #fca5a5; }
.cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; }
.cover h1 { border: 0; break-before: auto; font-size: 27pt; margin-bottom: 8pt; }
.cover .sub { font: 12.5pt Helvetica, Arial, sans-serif; color: var(--dim); margin-bottom: 22pt; }
.cover .box { border: 1pt solid var(--accent); background: #f3f6fb; padding: 9pt 11pt; font: 9pt/1.45 Helvetica, Arial, sans-serif; margin-bottom: 9pt; }
.cover .meta { font: 8.5pt Helvetica, Arial, sans-serif; color: var(--dim); }
.page-break { break-before: page; }
.toc li { list-style: none; margin: 2pt 0; font: 9pt Helvetica, Arial, sans-serif; } .toc ul { padding-left: 0; }
.keytable td:first-child { width: 22mm; }
`;

function render(report, md, toc, meta) {
  // Slugs come from the heading's plain source text, never from rendered HTML: every character outside a-z and 0-9
  // becomes a hyphen, so nothing markup-like can reach the id attribute.
  const slug = (plainText, seen) => { const b = plainText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 's'; let n = b; let i = 2; while (seen.has(n)) n = `${b}-${i++}`; seen.add(n); return n; };
  const seen = new Set();
  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    return `<h${depth} id="${slug(tokens.map((t) => t.raw ?? '').join(''), seen)}">${text}</h${depth}>\n`;
  };
  // A PDF cannot resolve a repository-relative link, so show the reference as text.
  renderer.link = function ({ href, tokens }) {
    const text = this.parser.parseInline(tokens);
    return /^(https?:|#)/.test(href) ? `<a href="${href}">${text}</a>` : `<span class="ref">${text}</span>`;
  };
  marked.setOptions({ gfm: true, breaks: false });
  const body = chips(marked.parse(md, { renderer }));
  const counts = census(md);
  const key = LABELS.map(([k, d]) => `<tr><td><span class="chip ${CLASS[k]}">${k}</span></td><td>${esc(d)}</td><td>${counts[k]}</td></tr>`).join('');
  const toc_html = toc.length ? `<div class="page-break"><h1 class="first" style="break-before:auto">Contents</h1><div class="toc"><ul>${toc.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div></div>` : '';
  const foot = `${report.customerSafe ? 'DRAFT, not approved for distribution' : 'DRAFT, internal'} · ${report.title}`.replace(/"/g, '');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(report.title)}</title><style>:root{--foot:"${foot}"}${CSS}</style></head><body>
<section class="cover"><h1>${esc(report.title)}</h1><div class="sub">${esc(report.subtitle)}</div>
<div class="box"><strong>${esc(report.audience)}</strong></div>
<div class="box">${esc(report.disclaimer)}</div>
<div class="box"><span class="chip assume">ASSUMPTION</span> <span class="chip ok">VERIFIED</span> <span class="chip draft">DRAFT</span> <span class="chip int">INTERNAL</span> <span class="chip appr">APPROVED</span> <span class="chip rev">REVIEW</span><br>Every statement is labelled. No item in this document is a customer-facing approved claim: no named approver is recorded for any wording.</div>
<div class="meta">Built ${esc(meta.date)} from repository revision ${esc(meta.rev)} (docs/business). Source: docs/business/reports/generated/${esc(report.out)}.md</div></section>
<div class="page-break"><h1 class="first" style="break-before:auto">How to read the labels</h1>
<p>Labels apply to a section, a table row or a bullet, not to every sentence. The count is how many label tags appear in this document; legend mentions in code formatting are not counted.</p>
<table class="keytable"><thead><tr><th>Label</th><th>Meaning</th><th>Count</th></tr></thead><tbody>${key}</tbody></table>
<p><strong>Planning assumptions</strong> are labelled ASSUMPTION. <strong>Verified claims</strong> are labelled VERIFIED and name their evidence. <strong>Draft and internal items</strong> are labelled DRAFT and INTERNAL. <strong>Customer-facing approved material</strong> is labelled APPROVED and is absent: ${counts.APPROVED === 0 ? 'the count above is zero' : 'see the count above'}. <strong>Professional-review items</strong> carry a REVIEW flag naming the profession.</p></div>
${toc_html}
<main>${body.replace(/<h1 /, '<h1 class="first" ')}</main></body></html>`;
}

// ── Printing ───────────────────────────────────────────────────────────────

function chrome() {
  for (const c of [process.env.GTM_PDF_CHROME, process.env.SMOKE_CHROME, '/opt/pw-browsers/chromium', 'google-chrome', 'chromium']) {
    if (!c) continue;
    const r = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (r.status === 0) return c;
  }
  throw new Error('No Chromium/Chrome found. Set GTM_PDF_CHROME to a binary. See docs/business/reports/PDF_BUILD.md.');
}

function print(bin, html, pdf) {
  const dir = mkdtempSync(join(tmpdir(), 'gtm-pdf-'));
  const file = join(dir, 'report.html');
  writeFileSync(file, html);
  try {
    spawnSync(bin, ['--headless', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, `file://${file}`], { stdio: 'ignore' });
    if (!existsSync(pdf) || statSync(pdf).size < 5000) throw new Error(`Chrome produced no usable PDF for ${pdf}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

let rev = 'unknown';
try { rev = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* not a git checkout */ }
const meta = { rev, date: process.env.GTM_PDF_DATE ?? '2026-10-05' };

const built = REPORTS.map((r) => ({ report: r, ...assemble(r) }));
if (CHECK) {
  for (const b of built) console.log(`ok  ${b.report.id}: ${b.md.split('\n').length} lines, ${b.toc.length} sections`);
  process.exit(0);
}
mkdirSync(OUT, { recursive: true });
mkdirSync(GEN, { recursive: true });
const bin = chrome();
for (const { report, md, toc } of built) {
  writeFileSync(join(GEN, `${report.out}.md`), `<!-- Generated by app/scripts/generate-gtm-pdf.mjs from docs/business. Do not edit; edit the sources and rebuild. -->\n\n${md}\n`);
  const pdf = join(OUT, `${report.out}.pdf`);
  print(bin, render(report, md, toc, meta), pdf);
  console.log(`built ${relative(root, pdf)} (${Math.round(statSync(pdf).size / 1024)} KB)`);
}
