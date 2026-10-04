/**
 * CLM-018 says where source labels appear. The evidence file lists the surfaces;
 * this holds the list to the code, so the claim cannot quietly outgrow what is
 * rendered.
 *
 * It guards one direction only, on purpose. A surface that adds a SourceBadge
 * without being listed makes the claim understate, which the register allows; a
 * listed surface that loses its badge makes the claim overstate, which it does
 * not. See `docs/CLM-018-SOURCE-LABEL-EVIDENCE.md`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TRUST_TEXT } from '../source';

const root = join(import.meta.dirname, '../../../..');
const evidence = readFileSync(join(root, 'docs/CLM-018-SOURCE-LABEL-EVIDENCE.md'), 'utf8');
const register = readFileSync(join(root, 'PUBLIC-CLAIMS-APPROVAL-REGISTER.md'), 'utf8');

/** The `## 3.` table: `| `path` | literal labels | label source |`. */
function surfaces(): { path: string; labels: string[] }[] {
  const section = evidence.split(/^## 3\. /m)[1]?.split(/^## 4\. /m)[0] ?? '';
  const out: { path: string; labels: string[] }[] = [];
  for (const line of section.split('\n')) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    const m = /^`((?:components|screens)\/[^`]+\.tsx)`$/.exec(cells[0] ?? '');
    if (!m) continue;
    const labels = (cells[1] ?? '').split(',').map((l) => l.trim()).filter((l) => l && l !== '—');
    out.push({ path: m[1], labels });
  }
  return out;
}

const row = register.split('\n').find((l) => l.startsWith('| CLM-018 |')) ?? '';
const wording = row.split('|')[2] ?? '';

describe('CLM-018 evidence', () => {
  const list = surfaces();

  it('lists the surfaces it counts', () => {
    expect(list.length).toBeGreaterThan(0);
    const said = /renders in (\d+) component and screen files/.exec(row);
    expect(said, 'the register row states how many files').not.toBeNull();
    expect(list.length).toBe(Number(said![1]));
  });

  it('lists only files that exist and still render a SourceBadge', () => {
    for (const { path } of list) {
      const file = join(root, 'app/src', path);
      expect(existsSync(file), `${path} exists`).toBe(true);
      expect(readFileSync(file, 'utf8'), `${path} renders SourceBadge`).toContain('SourceBadge');
    }
  });

  it('names a literal label only where the file writes it', () => {
    for (const { path, labels } of list) {
      const src = readFileSync(join(root, 'app/src', path), 'utf8');
      for (const label of labels) {
        expect(src, `${path} writes label="${label}"`).toContain(`label="${label}"`);
      }
    }
  });

  it('describes every label the badge can print', () => {
    for (const [key, text] of Object.entries(TRUST_TEXT)) {
      const said = evidence.toLowerCase().includes(text.toLowerCase()) || evidence.includes(`\`${key}\``);
      expect(said, `${key} (“${text}”) is described`).toBe(true);
    }
  });
});

describe('the CLM-018 register row', () => {
  it('exists, is not approved, and points at the evidence', () => {
    expect(row).not.toBe('');
    expect(row).toContain('NOT APPROVED');
    expect(row).toContain('docs/CLM-018-SOURCE-LABEL-EVIDENCE.md');
  });

  it('keeps its wording scoped to where a label is shown', () => {
    expect(wording).toMatch(/Where Semester shows a source label/);
    expect(wording, 'no universal quantifier in the claim itself').not.toMatch(/\b(every|all|always|each)\b/i);
  });
});
