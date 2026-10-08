/**
 * The claim-withdrawal runbook and its log.
 *
 * A withdrawal procedure that names files which have moved, or a log entry that
 * says DONE while a channel is still open, is how a claim stays up while the
 * record says it is down. This holds both to their own rules
 * (`docs/claim-withdrawals/README.md`).
 *
 * It checks the structure of the record, not whether the claim is gone: the
 * second needs a live page, which a unit test cannot fetch.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../../../..');
const runbook = readFileSync(join(root, 'docs/CLAIM-WITHDRAWAL-RUNBOOK.md'), 'utf8');
const topics = readFileSync(join(root, 'PUBLIC-CLAIMS-APPROVAL-REGISTER.md'), 'utf8');
const copy = readFileSync(join(root, 'docs/gtm/BRAND-AND-MARKETING-STRATEGY.md'), 'utf8');
const dir = join(root, 'docs/claim-withdrawals');

const STATES = ['Removed', 'Open', 'Not present', 'Cannot remove', 'Out of scope'];
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/;

/** `| Field | value |` rows of an entry, by field. */
function fields(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length === 2 && cells[0] && !/^-+$/.test(cells[0]) && cells[0] !== 'Field') out[cells[0]] = cells[1];
  }
  return out;
}

/** The channel table of an entry: `| Channel | Location | State | Notes |`. */
function channels(text: string): { channel: string; state: string; notes: string }[] {
  const section = text.split(/^## Channels/m)[1]?.split(/^## /m)[0] ?? '';
  const out: { channel: string; state: string; notes: string }[] = [];
  for (const line of section.split('\n')) {
    const c = line.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length === 4 && c[0] !== 'Channel' && !/^-+$/.test(c[0])) out.push({ channel: c[0], state: c[2], notes: c[3] });
  }
  return out;
}

const entries = readdirSync(dir)
  .filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f))
  .map((f) => ({ file: f, text: readFileSync(join(dir, f), 'utf8') }));

describe('the withdrawal runbook', () => {
  it('names only repository paths that exist', () => {
    const section = runbook.split(/^## 4\. Channel inventory/m)[1]?.split(/^## 5\. /m)[0] ?? '';
    const paths = [...section.matchAll(/`([A-Za-z0-9_./-]+(?:\/|\.(?:ts|tsx|md|html|js|json)))`/g)]
      .map((m) => m[1])
      .filter((p) => !p.includes('*'));
    expect(paths.length).toBeGreaterThan(5);
    for (const p of paths) expect(existsSync(join(root, p)), `${p} exists`).toBe(true);
  });

  it('points at the log and its test', () => {
    expect(runbook).toContain('claim-withdrawals/');
    expect(runbook).toContain('withdrawal.test.ts');
    expect(existsSync(join(dir, 'README.md'))).toBe(true);
  });
});

describe('the withdrawal log', () => {
  it('has at least the dry-run entry', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const { file, text } of entries) {
    describe(file, () => {
      const f = fields(text);
      const rows = channels(text);

      it('has every required field, and the exact words in backticks', () => {
        for (const k of ['Status', 'Claim', 'Detected', 'Completed', 'Trigger', 'Register rows', 'Escalation', 'Owner']) {
          expect(f[k], `${k} is present and not empty`).toBeTruthy();
        }
        expect(f.Claim).toMatch(/`[^`]+`/);
        expect(['OPEN', 'DONE']).toContain(f.Status);
      });

      it('records times that make sense', () => {
        expect(f.Detected).toMatch(ISO);
        if (f.Status === 'OPEN') {
          expect(f.Completed).toBe('—');
        } else {
          expect(f.Completed).toMatch(ISO);
          expect(f.Completed >= f.Detected, 'Completed is not before Detected').toBe(true);
        }
      });

      it('gives every channel a state, with a reason where it is not clear-cut', () => {
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
          expect(STATES, `${r.channel}: state "${r.state}"`).toContain(r.state);
          if (r.state === 'Cannot remove' || r.state === 'Out of scope') expect(r.notes, `${r.channel} needs a reason`).not.toBe('');
        }
      });

      it('is DONE only when no channel is still open', () => {
        if (f.Status === 'DONE') expect(rows.filter((r) => r.state === 'Open')).toEqual([]);
      });

      it('cites only claim and copy ids that exist', () => {
        for (const id of f['Register rows'].match(/CLM-\d{3}/g) ?? []) expect(topics, id).toContain(`| ${id} |`);
        for (const id of f['Register rows'].match(/\bM-\d+b?\b/g) ?? []) expect(copy, id).toContain(`| ${id}`);
      });
    });
  }
});
