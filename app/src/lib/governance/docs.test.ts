import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHARTERS } from './charters';
import { NEVER, SETTINGS, APPROVAL_FLOW } from './config-tiers';
import { CONTRACTS } from './data-contracts';
import { AUDIENCE_LABEL, SECTION_HEADING } from './incident-comms';
import { DEFINITION_OF_DONE, DEFINITION_OF_READY, QUALITY_METRICS, RELEASE_APPROVALS } from './quality-gates';
import { ROUTE_LABEL } from './scorecard';

/*
 * The operating-model docs are the human copy of these registries. A copy is
 * what drifts, so each doc is held to the list it describes, the way
 * FEATURE-FLAG-REGISTRY.md is held to flags.ts.
 */
const dir = resolve(__dirname, '../../../../docs/operating-model');
const doc = (name: string) => readFileSync(resolve(dir, name), 'utf8');

describe('operating-model docs match the registries', () => {
  it('portfolio: every route and every charter', () => {
    const d = doc('PORTFOLIO-GOVERNANCE.md');
    for (const label of Object.values(ROUTE_LABEL)) expect(d, label).toContain(label);
    for (const c of CHARTERS) expect(d, c.flag).toContain(`\`${c.flag}\``);
  });

  it('configuration: every setting, every never, every approval step', () => {
    const d = doc('CONFIGURATION-TIERS.md');
    for (const s of SETTINGS) expect(d, s.key).toMatch(new RegExp(`\\| \`${s.key.replace('.', '\\.')}\` \\| ${s.tier} \\|`));
    for (const n of NEVER) expect(d, n.key).toContain(`\`${n.key}\``);
    for (const step of APPROVAL_FLOW) expect(d, step).toContain(step);
  });

  it('stewardship: every contract, with its connector, class and SLA', () => {
    const d = doc('DATA-STEWARDSHIP.md');
    for (const c of CONTRACTS) {
      expect(d, c.domain).toContain(`| ${c.domain} | \`${c.connector}\` | ${c.classification} | ${c.freshnessSlaHours} h |`);
    }
  });

  it('incidents: every audience and every section heading', () => {
    const d = doc('INCIDENT-COMMUNICATIONS.md');
    for (const label of Object.values(AUDIENCE_LABEL)) expect(d, label).toContain(`| ${label} |`);
    for (const h of Object.values(SECTION_HEADING)) expect(d, h).toContain(h);
  });

  it('quality: every gate item and metric', () => {
    const d = doc('QUALITY-MANAGEMENT.md');
    for (const i of [...DEFINITION_OF_READY, ...DEFINITION_OF_DONE, ...RELEASE_APPROVALS]) expect(d, i).toContain(`- ${i}`);
    for (const m of QUALITY_METRICS) expect(d, m.name).toContain(`| ${m.name} |`);
  });

  it('links only to files that exist', () => {
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      for (const [, target] of doc(name).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        if (/^https?:/.test(target)) continue;
        expect(() => readFileSync(resolve(dir, target)), `${name} → ${target}`).not.toThrow();
      }
    }
  });
});
