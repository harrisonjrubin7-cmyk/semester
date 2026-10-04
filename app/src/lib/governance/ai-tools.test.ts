import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AGENTS } from '../../../../packages/institution/src/agents';
import { LOOKUPS } from '../lookup';
import { APPROVALS, REQUIRED_APPROVAL, TOOL_RECORDS, approvalAtLeast, toolRecord, type ToolRecord } from './ai-tools';
import { SYSTEMS } from './ai-systems';
import { APP_TOOLS } from '../toolscope';
import { TOOLS } from '../tools';

/**
 * Holds the tool registry to the tree in both directions, and holds each row's
 * `reach` and `undo` to the branch of `readProposal` that produces them, so a
 * row cannot say `mine` about a tool that now sends something.
 */

const root = join(import.meta.dirname, '../../..');
const source = readFileSync(join(root, 'src/lib/tools.ts'), 'utf8');

/** What each `if (call.name === 'x') { … }` branch of readProposal says of itself. */
function branches(text: string): Record<string, { reach: string[]; undo: string[] }> {
  const body = text.slice(text.indexOf('export function readProposal'));
  const parts = body.split(/\n {2}if \(call\.name === '([a-z_]+)'\) \{/);
  const out: Record<string, { reach: string[]; undo: string[] }> = {};
  for (let i = 1; i < parts.length; i += 2) {
    out[parts[i]] = {
      reach: [...new Set([...parts[i + 1].matchAll(/reach: '(\w+)'/g)].map((m) => m[1]))].sort(),
      undo: [...new Set([...parts[i + 1].matchAll(/how: '(\w+)'/g)].map((m) => m[1]))].sort(),
    };
  }
  return out;
}

describe('the probe', () => {
  it('finds all sixteen branches, so a regex that matched nothing could not pass the checks below', () => {
    const found = branches(source);
    expect(Object.keys(found)).toHaveLength(16);
    expect(found.tick_deadline).toEqual({ reach: ['mine'], undo: ['inverse'] });
    expect(found.open_screen).toEqual({ reach: ['look'], undo: [] });
  });
});

describe('the tool registry', () => {
  const names = TOOL_RECORDS.map((t) => t.name);

  it('has one row per tool a model may be offered, and no row for a tool that does not exist', () => {
    const offered = [...TOOLS.map((t) => t.name), ...LOOKUPS.map((t) => t.name)].sort();
    expect([...names].sort()).toEqual(offered);
    expect(new Set(names).size).toBe(names.length);
    expect(offered).toHaveLength(22);
  });

  it('denies by default: every tool any role or mode lists has a row', () => {
    for (const [role, def] of Object.entries(AGENTS)) {
      for (const tool of def.tools) expect(toolRecord(tool), `${role} lists ${tool}`).toBeDefined();
    }
    for (const tool of APP_TOOLS) expect(toolRecord(tool), `app mode lists ${tool}`).toBeDefined();
  });

  it('reads reach and undo out of the branch that produces them', () => {
    const found = branches(source);
    for (const t of TOOL_RECORDS.filter((r) => r.kind !== 'read')) {
      const branch = found[t.name];
      expect(branch, `${t.name} has no branch in readProposal`).toBeDefined();
      expect(branch.reach, `${t.name} reach`).toEqual([t.reach]);
      expect(branch.undo, `${t.name} undo`).toEqual(t.undo === 'none' ? [] : [t.undo]);
    }
  });

  it('gives every write a way back, and a view or a read nothing to put back', () => {
    for (const t of TOOL_RECORDS) {
      if (t.kind === 'write') expect(t.undo, t.name).not.toBe('none');
      else expect(t.undo, t.name).toBe('none');
    }
    expect(TOOL_RECORDS.filter((t) => t.kind === 'write')).toHaveLength(15);
  });

  it('asks an approval at least as strong as the reach needs, so a tool that sends cannot arrive with a tap', () => {
    for (const t of TOOL_RECORDS) expect(approvalAtLeast(t.approval, REQUIRED_APPROVAL[t.reach]), t.name).toBe(true);
    const sends: ToolRecord = { name: 'message_classmate', kind: 'write', action: 'D', reach: 'outward', undo: 'none', data: 'T2', approval: 'self' };
    expect(approvalAtLeast(sends.approval, REQUIRED_APPROVAL[sends.reach]), 'the control: a sending tool with a tap is refused').toBe(false);
    expect(APPROVALS.indexOf('self')).toBeLessThan(APPROVALS.indexOf('official-handoff'));
  });

  it('ties the action tier to the kind: reads and views are A, writes are proposals at C', () => {
    for (const t of TOOL_RECORDS) expect(t.action, t.name).toBe(t.kind === 'write' ? 'C' : 'A');
  });

  it('puts education-record data on exactly two tools, names both in the reconciliation, and offers neither to any institutional role', () => {
    const t3 = TOOL_RECORDS.filter((t) => ['T3', 'T4', 'T5', 'T6'].includes(t.data)).map((t) => t.name).sort();
    expect(t3).toEqual(['read_attendance', 'read_grades']);
    const reconcile = SYSTEMS.find((s) => s.id === 'AI-01.1')!.reconcile!;
    for (const name of t3) expect(reconcile, name).toContain(name);
    for (const [role, def] of Object.entries(AGENTS)) {
      for (const name of t3) expect((def.tools as readonly string[]).includes(name), `${role} offers ${name}`).toBe(false);
    }
  });
});
