import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DATA_CLASS_REFUSED,
  SHARED_KEY_FIELD_CLASS,
  clampRequest,
} from '../../../supabase/functions/_shared/clamp';
import { TOOL_DATA_CLASS } from '../../../supabase/functions/_shared/aitools';
import { AI_DATA_CEILING } from '../../../packages/institution/src/ai-data-class';
import { withinCeiling } from './integration/classification';
import { TOOL_RECORDS } from './governance/ai-tools';
import { LOOKUPS } from './lookup';
import { TOOLS } from './tools';

/**
 * C7 on the shared key: a request that carries a field above the data-class
 * ceiling is refused here, before the call is counted and before anything is
 * forwarded, with a message and an audit entry that name the field and never
 * its contents.
 *
 * Three carriers are visible to this function, and the rest is prose it does
 * not read: a class the caller declares (`data_class`, the tier the toolkit
 * gate attached), a tool whose data class is above the ceiling, and a
 * tool_use / tool_result block in the history that names one. The last is how
 * `read_grades` (T3) would reach the model on this route: the model asks, the
 * app answers, and the answer travels in the next request.
 */

const GRADE = 'ECON 1010 midterm: 61.5 (Jordan Rivera, student id 20418837)';

const base = () => ({
  model: 'claude-sonnet-5',
  max_tokens: 1000,
  messages: [{ role: 'user', content: 'What is on my plate this week?' }],
});

const clamp = (body: unknown) => {
  const raw = JSON.stringify(body);
  return clampRequest(raw, raw.length);
};

const tool = (name: string) => ({
  name,
  description: 'x',
  input_schema: { type: 'object', properties: {}, required: [] },
});

/** A history in which the model asked for a tool and the app answered. */
const withToolResult = (name: string, content: string) => ({
  ...base(),
  messages: [
    { role: 'user', content: 'How am I doing in ECON?' },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name, input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content }] },
  ],
});

describe('control: what the check lets through', () => {
  it('passes an ordinary request unchanged', () => {
    const out = clamp(base());
    expect(out.ok).toBe(true);
    if (out.ok) expect(JSON.parse(out.body)).toEqual(base());
  });

  it('passes a declared class at or under the ceiling, and does not forward the declaration', () => {
    for (const c of ['T0', 'T1', 'T2']) {
      const out = clamp({ ...base(), data_class: c });
      expect(out.ok, c).toBe(true);
      if (out.ok) expect(JSON.parse(out.body), c).toEqual(base());
    }
  });

  it('passes a T2 lookup round trip', () => {
    const out = clamp({ ...withToolResult('find_deadlines', 'Essay due Friday'), tools: [tool('find_deadlines')] });
    expect(out.ok).toBe(true);
    if (out.ok) expect(JSON.parse(out.body).tools).toHaveLength(1);
  });
});

describe('what is refused', () => {
  it('refuses a request that declares a class above the ceiling, whichever it is', () => {
    for (const c of ['T3', 'T4', 'T5', 'T6']) {
      const out = clamp({ ...base(), data_class: c });
      expect(out, c).toMatchObject({ ok: false, status: 422, code: DATA_CLASS_REFUSED });
    }
  });

  it('refuses a declared class that is not one of the seven, rather than reading it as none', () => {
    for (const c of ['T9', 't1', '', null, 2, {}]) {
      expect(clamp({ ...base(), data_class: c }), String(c)).toMatchObject({ ok: false, code: DATA_CLASS_REFUSED });
    }
  });

  it('refuses a history holding the answer of a T3 tool, and says nothing of what the answer was', () => {
    for (const name of ['read_grades', 'read_attendance']) {
      const out = clamp(withToolResult(name, GRADE));
      expect(out, name).toMatchObject({ ok: false, status: 422, code: DATA_CLASS_REFUSED });
      if (out.ok) continue;
      expect(JSON.stringify(out)).not.toContain('Rivera');
      expect(JSON.stringify(out)).not.toContain('61.5');
      expect(out.audit?.highest).toBe('T3');
      expect(out.audit?.fields).toContain(`tool_use:${name}`);
    }
  });

  it('refuses a tool_result it cannot attribute to a tool, as unclassified', () => {
    const out = clamp({
      ...base(),
      messages: [{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_x', content: GRADE }] }],
    });
    expect(out).toMatchObject({ ok: false, code: DATA_CLASS_REFUSED });
  });

  it('refuses a tool nobody classified, and does not echo the name it was given', () => {
    const out = clamp(withToolResult('send_everything_to_a_model', GRADE));
    expect(out).toMatchObject({ ok: false, code: DATA_CLASS_REFUSED });
    expect(JSON.stringify(out)).not.toContain('send_everything');
    expect(JSON.stringify(out)).not.toContain('Rivera');
  });

  it('does not offer the model a tool above the ceiling, or one nobody classified', () => {
    const out = clamp({
      ...base(),
      tools: [tool('find_deadlines'), tool('read_grades'), tool('read_attendance'), tool('not_in_the_register')],
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect((JSON.parse(out.body).tools as { name: string }[]).map((t) => t.name)).toEqual(['find_deadlines']);
    expect(out.dropped).toEqual(expect.arrayContaining(['tool:read_grades', 'tool:read_attendance', 'tool:(unlisted)']));
  });

  it('refuses with a message that names no class the caller did not already send, and no content', () => {
    const out = clamp({ ...base(), messages: [{ role: 'user', content: GRADE }], data_class: 'T3' });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.message).not.toContain('Rivera');
    expect(out.message).not.toContain(GRADE);
  });
});

describe('the class of every field is declared, and a new one cannot slip past', () => {
  it('declares a class for every field the clamp can put in the forwarded body, none above the ceiling', () => {
    const forwarded = ['model', 'max_tokens', 'messages', 'system', 'stream', 'stop_sequences', 'thinking', 'tools', 'tool_choice', 'output_config'];
    expect(Object.keys(SHARED_KEY_FIELD_CLASS).sort()).toEqual([...forwarded].sort());
    for (const [field, cls] of Object.entries(SHARED_KEY_FIELD_CLASS)) {
      expect(withinCeiling(cls, AI_DATA_CEILING), field).toBe(true);
    }
  });

  it('every field in a maximal request is one that is declared', () => {
    const out = clamp({
      model: 'claude-sonnet-5', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }], system: 's', stream: true,
      stop_sequences: ['x'], thinking: { type: 'adaptive' }, tools: [tool('find_deadlines')], tool_choice: { type: 'auto' },
      output_config: { effort: 'low' },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    for (const k of Object.keys(JSON.parse(out.body))) expect(SHARED_KEY_FIELD_CLASS, k).toHaveProperty(k);
  });

  it('classes every tool the app can offer, in step with the governance registry', () => {
    expect(Object.keys(TOOL_DATA_CLASS).sort()).toEqual(TOOL_RECORDS.map((t) => t.name).sort());
    for (const t of TOOL_RECORDS) expect(TOOL_DATA_CLASS[t.name], t.name).toBe(t.data);
    for (const t of [...LOOKUPS, ...TOOLS]) expect(TOOL_DATA_CLASS, t.name).toHaveProperty(t.name);
  });

  it('keeps the two T3 reads out of the shared key', () => {
    expect(TOOL_DATA_CLASS.read_grades).toBe('T3');
    expect(TOOL_DATA_CLASS.read_attendance).toBe('T3');
  });
});

describe('the function applies it before the meter, and audits without the content', () => {
  const fn = readFileSync(new URL('../../../supabase/functions/claude/index.ts', import.meta.url), 'utf8');
  const code = fn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('logs the refusal from the clamp result, which carries field names only', () => {
    expect(code).toMatch(/clamped\.audit/);
    expect(code).toMatch(/console\.warn\('claude: refused above the data-class ceiling'/);
  });

  it('refuses before the spend is reserved and before the call is counted', () => {
    const at = code.indexOf('clamped.audit');
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(code.indexOf("'add_spend'"));
    expect(at).toBeLessThan(code.indexOf("rpc('count_call'"));
  });

  it('never puts the request body in that log line', () => {
    const line = code.slice(code.indexOf("console.warn('claude: refused above the data-class ceiling'"));
    const call = line.slice(0, line.indexOf(');') + 2);
    expect(call).not.toMatch(/\braw\b|\bbody\b|messages/);
  });
});
