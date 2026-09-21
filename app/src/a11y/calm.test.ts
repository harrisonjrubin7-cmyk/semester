// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CALMS, calmOf, lowStimulation, readLook, stillerThanDevice } from '../lib/look';
import { CALM_ATTR, calmAsks, prefersLessMotion } from '../lib/prefers';

/**
 * The app's own answer about movement, which until now it did not have.
 *
 * §379 of `docs/EXPERIENCE_REQUIREMENTS.md` asks for a setting beside
 * `prefers-reduced-motion`, and §378 for a low-stimulation mode whose first
 * item is reduced motion. `lib/prefers.ts` read the media query and nothing
 * else, so somebody who wanted a still Semester had to still their whole
 * device to get one.
 *
 * ## What these are careful about
 *
 * The happy path — "asking for stillness gives stillness" — would pass
 * against a `prefersLessMotion` that returned `true` unconditionally, and
 * that version would be a bug rather than a feature: the app would stop
 * gliding for everybody including the people who never asked. So the
 * controls below matter more than the assertion they surround, and two of
 * them exist only to fail if this stops discriminating.
 */

/** A `matchMedia` that answers one way about reduced motion. */
function device(reduced: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: q.includes('prefers-reduced-motion') ? reduced : false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
}

afterEach(() => {
  document.documentElement.removeAttribute(CALM_ATTR);
});

describe('the setting itself', () => {
  it('is three steps and nothing else', () => {
    expect(CALMS.map((c) => c.id)).toEqual(['device', 'still', 'calm']);
  });

  it('defaults to deferring to the device', () => {
    expect(calmOf(undefined)).toBe('device');
    expect(calmOf('nonsense-from-a-future-build')).toBe('device');
    expect(readLook({}).calm).toBe('device');
  });

  /*
   * The ordering that makes this one setting rather than two toggles: `calm`
   * contains `still`. If these ever came apart, "low stimulation" would stop
   * implying reduced motion and the mode would be a decoration switch wearing
   * an accessibility label.
   */
  it('makes low stimulation a superset of less motion', () => {
    expect(stillerThanDevice('device')).toBe(false);
    expect(stillerThanDevice('still')).toBe(true);
    expect(stillerThanDevice('calm')).toBe(true);

    expect(lowStimulation('device')).toBe(false);
    expect(lowStimulation('still')).toBe(false);
    expect(lowStimulation('calm')).toBe(true);
  });
});

describe('what the app asks before it moves', () => {
  it('reduces when the setting says so, on a device that did not ask', () => {
    device(false);
    expect(prefersLessMotion(), 'without the setting').toBe(false);
    document.documentElement.setAttribute(CALM_ATTR, 'still');
    expect(prefersLessMotion(), 'with it').toBe(true);
  });

  it('reduces under low stimulation too, since it contains less motion', () => {
    device(false);
    document.documentElement.setAttribute(CALM_ATTR, 'calm');
    expect(prefersLessMotion()).toBe(true);
  });

  /*
   * The control. A `prefersLessMotion` that had simply started returning
   * `true` would pass both tests above and would have stopped every animation
   * in the app for every user — the failure that looks most like success.
   */
  it('still glides for somebody who has asked for neither', () => {
    device(false);
    document.documentElement.setAttribute(CALM_ATTR, 'device');
    expect(prefersLessMotion(), 'device-default must not reduce').toBe(false);
    document.documentElement.removeAttribute(CALM_ATTR);
    expect(prefersLessMotion(), 'and absent must not either').toBe(false);
  });

  /*
   * The second control, and the direction the cost is uneven in. An attribute
   * that has not been written yet — a server render, the first paint before
   * the effect runs — must not override a device that is asking for stillness.
   */
  it('never overrides a device that asked, whatever the attribute says', () => {
    device(true);
    for (const set of ['device', 'still', 'calm']) {
      document.documentElement.setAttribute(CALM_ATTR, set);
      expect(prefersLessMotion(), set).toBe(true);
    }
    document.documentElement.removeAttribute(CALM_ATTR);
    expect(prefersLessMotion(), 'unset').toBe(true);
  });

  it('reads nothing into an attribute it does not recognise', () => {
    device(false);
    document.documentElement.setAttribute(CALM_ATTR, 'CALM');
    expect(calmAsks(), 'the attribute is written by calmOf, so it is lowercase').toBe(false);
    document.documentElement.setAttribute(CALM_ATTR, '');
    expect(calmAsks()).toBe(false);
  });
});

describe('the stylesheet half, which script cannot do', () => {
  const CSS = readFileSync(join(process.cwd(), 'src', 'styles', 'app.css'), 'utf8');

  /*
   * `lib/prefers.ts` only reaches the scrolls the app performs itself. Every
   * CSS animation and transition is out of its reach entirely, so the setting
   * is half-built without these rules — and a test that only checked the
   * function would have called it finished.
   */
  it('stills animations and transitions for both settings', () => {
    for (const set of ['still', 'calm']) {
      expect(CSS, set).toContain(`:root[data-calm='${set}'] *`);
    }
    expect(CSS).toContain('animation-duration: 0.001ms !important');
  });

  it('tones decoration down for low stimulation only', () => {
    const calmOnly = CSS.slice(CSS.indexOf(":root[data-calm='calm'] * {"));
    expect(calmOnly).toContain('box-shadow: none !important');
    expect(CSS).not.toContain(":root[data-calm='still'] * {\n  box-shadow");
  });

  /* The device rule stays. The app setting adds to it and never replaces it. */
  it('leaves the device media query in place', () => {
    expect(CSS).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
