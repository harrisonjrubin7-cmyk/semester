// Parses every ```mermaid block in the given Markdown files. Needs: npm i mermaid@11 jsdom   (run from a directory that has them)
//   node appendix/check_mermaid.mjs *.md   Exits non-zero on a parse error; a deliberately broken diagram is the control.
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const mermaid = (await import('mermaid')).default;
mermaid.initialize({ startOnLoad: false });
let bad = 0, n = 0;
for (const f of process.argv.slice(2)) {
  const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(/```mermaid\n([\s\S]*?)```/g)) {
    n++;
    try { await mermaid.parse(m[1]); console.log('ok  ', f.split('/').pop(), '#' + n, m[1].split('\n')[0]); }
    catch (e) { bad++; console.log('FAIL', f.split('/').pop(), '#' + n, String(e.message || e).split('\n').slice(0, 4).join(' | ')); }
  }
}
// control: a deliberately broken diagram must fail, or the checker is blind
try { await mermaid.parse('erDiagram\n  A ||--o{{ B : '); console.log('CONTROL FAILED: broken diagram parsed'); bad++; } catch { console.log('control ok (broken diagram rejected)'); }
process.exit(bad ? 1 : 0);
