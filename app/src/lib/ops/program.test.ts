import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TASKS } from '../launch/ninety-day';
import {
  byId,
  closure,
  cycle,
  longestPath,
  parseMotions,
  parseNodes,
  pathWeeks,
  render,
  unestimated,
  unknownNeeds,
  type Node,
} from './program';

/**
 * The program pack is held to the registers it stands on. It does not restate
 * them: the external queue, the launch risk register and the 90-day tasks stay
 * where they are, and this fails when the pack names a row that is not there,
 * leaves one out, or states a path the nodes do not give.
 */

const root = join(import.meta.dirname, '../../../..');
const dir = join(root, 'docs/program');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const model = read('docs/program/02-DEPENDENCIES-AND-CRITICAL-PATH.md');
const nodes = parseNodes(model);
const motions = parseMotions(model);

const idsIn = (text: string, re: RegExp) => [...new Set(text.match(re) ?? [])].sort();

describe('the dependency model', () => {
  it('reads every node row, once', () => {
    expect(nodes.length).toBeGreaterThanOrEqual(27);
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
  });

  it('has a node for every item of the external evidence queue, and no EXT node the queue lacks', () => {
    const queue = idsIn(read('docs/finalization/EXTERNAL-EVIDENCE-QUEUE.md'), /EXT-\d{3}/g);
    expect(queue).toHaveLength(18);
    expect(nodes.map((n) => n.id).filter((i) => i.startsWith('EXT-')).sort()).toEqual(queue);
  });

  it('draws no edge to a node that does not exist, and no cycle', () => {
    expect(unknownNeeds(nodes)).toEqual([]);
    expect(cycle(nodes)).toBeNull();
  });

  it('states, for each motion, the path figures its nodes give', () => {
    expect(motions.map((m) => m.name)).toEqual([
      'Invitation-only individual validation',
      'Design-partner activation',
      'Paid institutional pilot (manual data)',
      'Broad enterprise sale',
    ]);
    for (const m of motions) {
      expect(m.weeks, `${m.name}: weeks`).toBe(render(pathWeeks(nodes, m.requires)));
      expect(m.unestimated, `${m.name}: unestimated nodes`).toEqual(unestimated(nodes, m.requires));
    }
  });

  it('states the longest chain it names for the first two motions', () => {
    const table = model.slice(model.indexOf('Longest chain by the upper estimate'));
    const chain = (id: string) => longestPath(nodes, id).join(' → ');
    expect(table).toContain(`| Invitation-only individual validation | ${chain('PGM-08')} |`);
    expect(table).toContain(`| Design-partner activation | ${chain('PGM-07')} |`);
  });

  it('keeps the enterprise motion a superset of the paid pilot, which is a superset of design-partner activation', () => {
    const c = (name: string) => closure(nodes, motions.find((m) => m.name.startsWith(name))!.requires);
    const [ind, dp, paid, ent] = ['Invitation', 'Design', 'Paid', 'Broad'].map(c);
    for (const id of dp) expect(paid.has(id), `paid pilot lacks ${id}`).toBe(true);
    for (const id of paid) expect(ent.has(id), `enterprise lacks ${id}`).toBe(true);
    expect(ind.has('PGM-03')).toBe(false); // individual validation needs no customer
  });

  // Controls. A checker that cannot see a fault passes any page.
  it('sees a cycle, an unknown edge and a changed estimate', () => {
    const n = (id: string, needs: string[], weeks: Node['weeks'] = null): Node => ({ id, needs, weeks });
    expect(cycle([n('PGM-01', ['PGM-02']), n('PGM-02', ['PGM-01'])])).toEqual(['PGM-01', 'PGM-02', 'PGM-01']);
    expect(unknownNeeds([n('PGM-01', ['PGM-99'])])).toEqual(['PGM-01 needs PGM-99']);
    const base = [n('EXT-001', [], [2, 6]), n('PGM-07', ['EXT-001'], [0, 0])];
    expect(pathWeeks(base, ['PGM-07'])).toEqual([2, 6]);
    expect(pathWeeks([n('EXT-001', [], [3, 6]), base[1]], ['PGM-07'])).toEqual([3, 6]);
    expect(unestimated([n('EXT-001', []), base[1]], ['PGM-07'])).toEqual(['EXT-001']);
    expect(byId(base).size).toBe(2);
  });
});

describe('the pack and the registers it stands on', () => {
  const pack = readdirSync(dir).filter((f) => f.endsWith('.md'));

  it('covers every launch risk (FR-nnn) in the RAID register and cites none that is not registered', () => {
    const registered = idsIn(read('LAUNCH-RISK-REGISTER.md'), /FR-\d{3}/g);
    expect(registered.length).toBeGreaterThanOrEqual(16);
    const cited = idsIn(read('docs/program/03-RAID.md'), /FR-\d{3}/g);
    expect(cited).toEqual(registered);
  });

  it('names every 90-day task in the tenant launch plan, and no task the program lacks', () => {
    const text = read('docs/program/06-TENANT-LAUNCH-AND-FOLLOW-UP.md');
    const cited = [...text.matchAll(/`([a-z][a-z0-9-]+)`/g)].map((m) => m[1]);
    for (const t of TASKS) expect(cited, `06 never names task ${t.id}`).toContain(t.id);
  });

  it('cites an external or program node only if the model has it', () => {
    const known = new Set(nodes.map((n) => n.id));
    for (const f of pack) {
      for (const id of idsIn(read(`docs/program/${f}`), /\b(?:EXT|PGM)-\d{2,3}\b/g)) {
        expect(known.has(id), `${f} cites ${id}`).toBe(true);
      }
    }
  });

  it('gives each RAID id once and cites no RAID id it does not define', () => {
    const raid = read('docs/program/03-RAID.md');
    const defined = [...raid.matchAll(/^\| (RAID-[RAID]\d{2}) \|/gm)].map((m) => m[1]);
    expect(defined.length).toBeGreaterThan(15);
    expect(new Set(defined).size).toBe(defined.length);
    for (const f of pack) {
      for (const id of idsIn(read(`docs/program/${f}`), /RAID-[RAID]\d{2}/g)) {
        expect(defined, `${f} cites ${id}`).toContain(id);
      }
    }
  });

  it('links only to files that exist', () => {
    for (const f of pack) {
      const text = read(`docs/program/${f}`);
      for (const m of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        const target = m[1];
        if (/^[a-z]+:/i.test(target)) continue;
        expect(existsSync(resolve(dirname(join(dir, f)), target)), `${f} links ${target}`).toBe(true);
      }
    }
  });

  it('reports no outcome in a status report without evidence, a date and an acceptor', () => {
    const status = read('docs/program/STATUS-2026-10-04.md');
    const section = status.split('## Verified outcomes')[1]?.split('\n## ')[0] ?? '';
    const rows = section.split('\n').filter((l) => /^\| V\d{2} \|/.test(l));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const c = row.split('|').slice(1, -1).map((x) => x.trim());
      expect(c.length, row).toBe(6);
      expect(c[3], `${c[0]} has no evidence`).not.toBe('');
      expect(c[4], `${c[0]} has no date`).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(c[5], `${c[0]} has no acceptor`).not.toBe('');
    }
  });
});
