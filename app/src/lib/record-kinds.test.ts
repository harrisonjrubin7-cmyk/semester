import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RECORD_FACTS, RECORD_KINDS, RECORD_SCREENS, isRecordKind } from './record-kinds';
import { TRUST_KINDS } from './source';

const root = resolve(__dirname, '..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('the record hierarchy', () => {
  it('has the six kinds a student meets, each with all six facts filled in', () => {
    expect([...RECORD_KINDS]).toEqual(['transcript', 'degree_audit', 'plan', 'evidence', 'credential', 'portfolio']);
    for (const k of RECORD_KINDS) {
      const f = RECORD_FACTS[k];
      for (const field of ['type', 'authority', 'can', 'cannot', 'next'] as const) {
        expect(f[field].trim().length, `${k}.${field}`).toBeGreaterThan(field === 'authority' ? 2 : 8);
      }
      expect(TRUST_KINDS as readonly string[], `${k}.source`).toContain(f.source);
    }
  });

  it('gives every kind a limit and a next step somebody else can take', () => {
    for (const k of RECORD_KINDS) {
      expect(RECORD_FACTS[k].cannot, k).toMatch(/\b(issue|certify|vouch|register|confirm|share|verify|hold|change|check|clear)\b/i);
      expect(RECORD_FACTS[k].next, k).not.toMatch(/wait for semester|semester will|semester (?:has|is) (?:registered|verified|confirmed)/i);
    }
  });

  it('never has Semester claim an authority that is the school’s', () => {
    for (const k of ['transcript', 'degree_audit', 'credential'] as const) {
      expect(RECORD_FACTS[k].authority, k).not.toMatch(/\bsemester\b/i);
      expect(RECORD_FACTS[k].can, k).not.toMatch(/\b(issue|certify|approve|grant)s?\b(?! a credential)/i);
    }
    // Owned by the student, and said so.
    expect(RECORD_FACTS.plan.authority).toBe('You');
    expect(RECORD_FACTS.portfolio.authority).toBe('You');
  });

  it('describes only what exists: a credential wallet is not built, and the kind says so', () => {
    expect(RECORD_FACTS.credential.can).toMatch(/not built/i);
  });

  it('reads a kind from the closed list only', () => {
    expect(isRecordKind('plan')).toBe(true);
    expect(isRecordKind('grade')).toBe(false);
    expect(isRecordKind(undefined)).toBe(false);
  });
});

describe('the screens that carry a label', () => {
  it('names a kind that exists for every screen it lists', () => {
    for (const [file, kind] of Object.entries(RECORD_SCREENS)) expect(RECORD_KINDS as readonly string[], file).toContain(kind);
  });

  it('holds each listed screen to importing the label and naming its kind', () => {
    for (const [file, kind] of Object.entries(RECORD_SCREENS)) {
      const text = read(file);
      expect(text, `${file} does not import RecordLabel`).toMatch(/import \{[^}]*\bRecordLabel\b[^}]*\} from '\.\/RecordLabel'/);
      expect(text, `${file} does not render a ${kind} label`).toContain(`<RecordLabel kind="${kind}"`);
    }
  });

  it('is not fooled: a screen that has neither is caught by the same check', () => {
    const bare = "import { useState } from 'react';\nexport const X = () => null;";
    expect(bare).not.toMatch(/import \{[^}]*\bRecordLabel\b[^}]*\} from '\.\/RecordLabel'/);
    expect(bare).not.toContain('<RecordLabel kind="degree_audit"');
  });
});
