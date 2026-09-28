import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LIBRARY, NEEDS_EVIDENCE, REGULATED, SECTIONS, renderLibrary, unsupportedClaims } from './rfp';

/**
 * The RFP library may not say more than the tree can show.
 *
 * Every rule below has a control beside it, because each one passes perfectly
 * against a probe that reads nothing: a register parsed to zero rows, a
 * registry file that moved, a claim scanner whose pattern matches no word.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** HECVAT register rows: id → status. */
function hecvat(): Map<string, string> {
  const rows = new Map<string, string>();
  for (const line of read('docs/market-readiness/HECVAT_READINESS.md').split('\n')) {
    const m = /^\| ([A-Z0-9]+-\d+) \|[^|]*\|[^|]*\| `([A-Z_]+)` \|/.exec(line);
    if (m) rows.set(m[1], m[2]);
  }
  return rows;
}

describe('the RFP response library', () => {
  it('answers every section the command lists, once per id', () => {
    for (const s of SECTIONS) expect(LIBRARY.some((a) => a.section === s), s).toBe(true);
    expect(new Set(LIBRARY.map((a) => a.id)).size).toBe(LIBRARY.length);
  });

  it('can tell a present file from a missing one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-rfp-evidence.md'))).toBe(false);
  });

  it('cites only files that exist', () => {
    for (const a of LIBRARY) {
      for (const e of a.evidence) expect(existsSync(join(root, e)), `${a.id} cites ${e}`).toBe(true);
    }
  });

  it('never claims something exists without citing what shows it', () => {
    for (const a of LIBRARY.filter((x) => NEEDS_EVIDENCE.includes(x.status))) {
      expect(a.evidence.length, `${a.id} is ${a.status} with nothing cited`).toBeGreaterThan(0);
    }
  });

  describe('against the HECVAT register', () => {
    const register = hecvat();

    it('reads the register, and sees both a READY and an unready control', () => {
      expect(register.size).toBeGreaterThanOrEqual(30);
      expect(register.get('IAM-2')).toBe('READY');
      expect(register.get('VULN-2')).toBe('NOT_STARTED');
    });

    it('cites only controls the register has', () => {
      for (const a of LIBRARY) for (const h of a.hecvat ?? []) expect(register.has(h), `${a.id} cites ${h}`).toBe(true);
    });

    it('rests every available security, privacy, accessibility and AI answer on at least one control', () => {
      const bare = LIBRARY.filter((a) => a.status === 'available' && REGULATED.includes(a.section) && !(a.hecvat?.length));
      expect(bare.map((a) => a.id)).toEqual([]);
    });

    it('says "available now" only where every control it rests on is READY', () => {
      for (const a of LIBRARY.filter((x) => x.status === 'available')) {
        for (const h of a.hecvat ?? []) {
          expect(register.get(h), `${a.id} is available but ${h} is ${register.get(h)}`).toBe('READY');
        }
      }
    });
  });

  describe('integrations', () => {
    const registry = read('app/server/institution/adapters.ts');
    const empty = /export const adapters: InstitutionAdapter\[\] = \[\];/.test(registry);

    it('finds the production adapter registry declaration, so the next rule is about something', () => {
      expect(registry).toMatch(/export const adapters: InstitutionAdapter\[\] =/);
    });

    it('claims no approved integration while the registry is empty', () => {
      if (!empty) return; // the day an adapter is installed, the rule below takes over
      expect(LIBRARY.filter((a) => a.status === 'approved-integration').map((a) => a.id)).toEqual([]);
    });

    it('ties each approved integration to the installed adapter it names', () => {
      const installed = (id: string) => new RegExp(`id:\\s*['"]${id}['"]`).test(registry);
      for (const a of LIBRARY.filter((x) => x.status === 'approved-integration')) {
        expect(a.adapter, `${a.id} names no adapter`).toBeTruthy();
        expect(installed(a.adapter!), `${a.id} names ${a.adapter}, which is not installed`).toBe(true);
      }
      // The control: a registry with only a Canvas adapter does not stand behind a SIS answer.
      const canvasOnly = "export const adapters: InstitutionAdapter[] = [{ id: 'canvas' }];";
      expect(new RegExp(`id:\\s*['"]canvas['"]`).test(canvasOnly)).toBe(true);
      expect(new RegExp(`id:\\s*['"]banner-sis['"]`).test(canvasOnly)).toBe(false);
    });
  });

  describe('certification language', () => {
    it('catches a bare claim, and lets a negated one through (the control)', () => {
      expect(unsupportedClaims('Semester is FERPA compliant.')).toEqual(['compliant']);
      expect(unsupportedClaims('We guarantee real-time sync.')).toEqual(['guarantee', 'real-time']);
      expect(unsupportedClaims('Semester does not claim WCAG conformance.')).toEqual([]);
      // A negation in an earlier sentence does not cover a claim in the next.
      expect(unsupportedClaims('No pen test yet. It is certified.')).toEqual(['certified']);
      // Nor does one in an earlier clause, across a comma or a contrast.
      expect(unsupportedClaims('No audit, but Semester is certified.')).toEqual(['certified']);
      expect(unsupportedClaims('There is no audit however Semester is certified.')).toEqual(['certified']);
    });

    it('appears nowhere in an answer unless negated', () => {
      for (const a of LIBRARY) expect(unsupportedClaims(a.answer), a.id).toEqual([]);
    });
  });

  it('is published verbatim in the library document', () => {
    const doc = read('docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md');
    expect(doc, 'the document is out of date: paste renderLibrary() output into its table').toContain(renderLibrary());
  });
});
