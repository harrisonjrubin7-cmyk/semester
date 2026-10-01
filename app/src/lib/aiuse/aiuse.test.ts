/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_MODULES } from '@semester/contract';
import {
  CLASS_WORDS, CORE_MODULE_LIBS, ENTRY_POINTS, NEVER_CLASSES, PERMITTABLE_CLASSES, REASONS, REASON_WORDS,
  decide, readAnswer,
} from './spec';

const ROOT = join(__dirname, '..', '..', '..', '..');
const SQL = readFileSync(join(ROOT, 'supabase', 'migrations', '20260930290000_ai_governance.sql'), 'utf8');

const listIn = (fn: string): string[] => {
  const m = SQL.match(new RegExp(`function private\\.${fn}\\(\\)[\\s\\S]*?array\\[([\\s\\S]*?)\\]::text\\[\\]`));
  expect(m, `private.${fn}() in the migration`).not.toBeNull();
  return [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
};

describe('the closed lists', () => {
  it('are the database’s lists, in the database’s order', () => {
    expect(listIn('ai_use_never_classes')).toEqual([...NEVER_CLASSES]);
    expect(listIn('ai_use_permittable_classes')).toEqual([...PERMITTABLE_CLASSES]);
  });

  it('share nothing: a class is never or it can be permitted', () => {
    expect(NEVER_CLASSES.filter((c) => (PERMITTABLE_CLASSES as readonly string[]).includes(c))).toEqual([]);
  });

  it('name the five things AI must never be asked to decide about a person', () => {
    expect([...NEVER_CLASSES].sort()).toEqual(['admissions_decision', 'aid_amount', 'disciplinary', 'grade_or_transcript', 'health']);
  });

  it('have words for every class and every reason', () => {
    for (const c of [...NEVER_CLASSES, ...PERMITTABLE_CLASSES]) expect(CLASS_WORDS[c].length).toBeGreaterThan(5);
    for (const r of REASONS) expect(REASON_WORDS[r].length).toBeGreaterThan(10);
  });

  it('keep the log’s reasons equal to the decision’s reasons', () => {
    const m = SQL.match(/reason\s+text\s+not null check \(reason in \(([\s\S]*?)\)\)/);
    expect(m, 'the log reason check').not.toBeNull();
    expect([...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])).toEqual([...REASONS]);
  });

  it('keep a never class out of the policy table by a check, which not even the owner can pass', () => {
    expect(SQL).toMatch(/data_class\s+text\s+not null check \(data_class = any \(private\.ai_use_permittable_classes\(\)\)\)/);
  });
});

describe('the decision, in the SQL’s order', () => {
  const modules = [...CORE_MODULES];
  const ask = (module: string, dataClass: string, policy: boolean | null, killed = false) =>
    decide({ module, dataClass, policy, killed }, modules);

  it('is no for every module and class until a school says yes', () => {
    for (const m of modules) for (const c of PERMITTABLE_CLASSES) {
      expect(ask(m, c, null)).toEqual({ allowed: false, reason: 'no_policy' });
    }
  });

  // The control: a decision that always said no would pass everything above.
  it('can say yes, for exactly the module and class a school allowed', () => {
    expect(ask('lms_assignments', 'instructor_material', true)).toEqual({ allowed: true, reason: 'permitted_by_school' });
    expect(ask('lms_assignments', 'instructor_material', false)).toEqual({ allowed: false, reason: 'denied_by_school' });
  });

  it('never allows grades, admissions decisions, aid amounts, discipline or health, with a yes on file, in any module', () => {
    for (const m of modules) for (const c of NEVER_CLASSES) {
      expect(ask(m, c, true), `${m} / ${c}`).toEqual({ allowed: false, reason: 'never_class' });
    }
  });

  it('refuses AI on admissions decisions and on aid amounts however the question is spelled', () => {
    for (const c of ['admissions_decision', ' ADMISSIONS_DECISION ', 'aid_amount', 'Aid_Amount']) {
      for (const m of ['admissions', 'financial_aid', ' Admissions ']) {
        expect(ask(m, c, true).allowed, `${m} / ${c}`).toBe(false);
      }
    }
  });

  it('asks the never list before the module, so an unknown module cannot hide a never class', () => {
    expect(ask('not_a_module', 'health', true).reason).toBe('never_class');
    expect(ask('not_a_module', 'catalog_public', true).reason).toBe('unknown_module');
    expect(ask('records', 'made_up', true).reason).toBe('unknown_class');
  });

  it('is overridden by the kill switch, then restored by lifting it', () => {
    expect(ask('records', 'catalog_public', true, true)).toEqual({ allowed: false, reason: 'kill_switch' });
    expect(ask('records', 'catalog_public', true, false).allowed).toBe(true);
  });
});

describe('what an entry point does with the answer', () => {
  it('allows only one row that says allowed, with the school’s permission as the reason', () => {
    expect(readAnswer([{ allowed: true, reason: 'permitted_by_school' }])).toEqual({ allowed: true, reason: 'permitted_by_school' });
  });

  it('treats everything else as no', () => {
    expect(readAnswer(null).allowed).toBe(false);
    expect(readAnswer([]).allowed).toBe(false);
    expect(readAnswer([{ allowed: true, reason: 'permitted_by_school' }, { allowed: true, reason: 'permitted_by_school' }]).allowed).toBe(false);
    expect(readAnswer([{ allowed: true, reason: 'something_new' }])).toEqual({ allowed: false, reason: 'unavailable' });
    expect(readAnswer([{ allowed: true, reason: 'no_policy' }]).allowed).toBe(false);
    expect(readAnswer([{ allowed: 'true', reason: 'permitted_by_school' }]).allowed).toBe(false);
    expect(readAnswer({ allowed: true, reason: 'permitted_by_school' }).allowed).toBe(false);
  });
});

// ── The entry points ─────────────────────────────────────────────────────

const SKIP = new Set(['node_modules', 'dist', '.git', '__docs', '__pix']);
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|live\.test|d)\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** A line that sends something to a model provider. */
export const REACHES_A_MODEL = /https:\/\/api\.(?:anthropic|openai)\.com|from ['"]openai['"]|@anthropic-ai\/sdk/;
/** A line that imports a Core module's code. */
export const IMPORTS_CORE = new RegExp(`from ['"][./]*(?:lib/)?(?:${CORE_MODULE_LIBS.join('|')})(?:/[^'"]*)?['"]`);

const rel = (p: string) => relative(ROOT, p).split('\\').join('/');
const code = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

describe('the routes to a model', () => {
  const files = ['app/src', 'app/server', 'supabase/functions', 'packages'].flatMap((d) => sources(join(ROOT, d)));

  it('are all written down: a file that reaches a provider and is not in ENTRY_POINTS is red', () => {
    const found = files.filter((f) => REACHES_A_MODEL.test(code(readFileSync(f, 'utf8')))).map(rel).sort();
    expect(found).toEqual(ENTRY_POINTS.map((e) => e.path).sort());
  });

  it('would catch a new one (control)', () => {
    expect(REACHES_A_MODEL.test(`await fetch('https://api.anthropic.com/v1/messages')`)).toBe(true);
    expect(REACHES_A_MODEL.test(`import OpenAI from 'openai';`)).toBe(true);
    expect(REACHES_A_MODEL.test(`const harmless = 'anthropic';`)).toBe(false);
  });

  it('read no Core module’s data today, which is why nothing calls ai_use_permitted yet', () => {
    const aiPaths = [
      ...ENTRY_POINTS.map((e) => join(ROOT, e.path)),
      ...sources(join(ROOT, 'app/src/ai')),
      ...sources(join(ROOT, 'app/src/intelligence')),
      ...files.filter((f) => /app\/server\/institution\/intelligence[^/]*\.ts$/.test(rel(f))),
      join(ROOT, 'app/src/lib/assistant.ts'),
    ];
    const offenders = aiPaths.filter((f) => IMPORTS_CORE.test(code(readFileSync(f, 'utf8')))).map(rel);
    expect(offenders, 'an AI path now imports a Core module: call public.ai_use_permitted before it reads or sends that data, then say so in ENTRY_POINTS').toEqual([]);
  });

  it('would catch an AI path that began to read a module (control)', () => {
    expect(IMPORTS_CORE.test(`import { loadGrades } from '../gradebook/client';`)).toBe(true);
    expect(IMPORTS_CORE.test(`import { audit } from '../lib/degreeaudit/audit';`)).toBe(true);
    expect(IMPORTS_CORE.test(`import { x } from '../lib/calendar';`)).toBe(false);
  });
});
