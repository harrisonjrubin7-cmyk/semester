import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRESETS } from './accessmode';
import { readLook, TEXT_SPACINGS, textSpacingOf, tokensFor } from './look';
import { reducer } from '../state/reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type State } from '../state/shape';

const blank = (): State => ({ ...DEFAULT_PERSISTED, ...initialEphemeral() });

/**
 * Letter and word spacing as a setting. The 1.4.12 sweep
 * (`scripts/spacing-sweep.mjs`) measures the layout at 0.12em / 0.16em, so a
 * setting is only safe to offer while it stays inside that.
 */
describe('text spacing', () => {
  it('writes the two variables, and normal is zero', () => {
    expect(tokensFor({})['--tracking-body']).toBe('0em');
    expect(tokensFor({})['--word-space']).toBe('0em');
    expect(tokensFor({ textSpacing: 'open' })['--tracking-body']).toBe('0.02em');
    expect(tokensFor({ textSpacing: 'open' })['--word-space']).toBe('0.08em');
  });

  it('never offers more than the sweep measures', () => {
    for (const t of TEXT_SPACINGS) {
      expect(t.tracking).toBeLessThanOrEqual(0.12);
      expect(t.word).toBeLessThanOrEqual(0.16);
    }
  });

  it('falls back to normal for anything it does not know', () => {
    expect(textSpacingOf('airy').id).toBe('normal');
    expect(textSpacingOf(undefined).id).toBe('normal');
    expect(readLook({ textSpacing: 'enormous' }).textSpacing).toBe('normal');
    expect(readLook({ textSpacing: 'wide' }).textSpacing).toBe('wide');
  });

  it('is set and kept by setLook, and a bad value does not stick', () => {
    const s = reducer(blank(), { type: 'setLook', look: { textSpacing: 'wide' } });
    expect(s.textSpacing).toBe('wide');
    expect(reducer(s, { type: 'setLook', look: { textSpacing: 'enormous' } }).textSpacing).toBe('normal');
  });

  it('is part of the Easier reading preset and no other', () => {
    expect(PRESETS.find((p) => p.id === 'reading')?.look.textSpacing).toBe('open');
    expect(PRESETS.filter((p) => p.id !== 'reading').every((p) => p.look.textSpacing === undefined)).toBe(true);
  });

  it('is applied by the stylesheet, on the element every screen inherits from', () => {
    const css = readFileSync(join(__dirname, '../styles/app.css'), 'utf8');
    expect(css).toMatch(/letter-spacing:\s*var\(--tracking-body,\s*0\);/);
    expect(css).toMatch(/word-spacing:\s*var\(--word-space,\s*0\);/);
  });
});
