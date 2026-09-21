import { describe, expect, it } from 'vitest';
import {
  KINDS,
  MOST,
  context,
  deviceClass,
  isKind,
  routeShape,
  sayable,
  shownLine,
} from './feedback';

describe('the route never leaves as a route', () => {
  it('keeps the screen alone when that is all there is', () => {
    expect(routeShape('#/today')).toBe('/today');
    expect(routeShape('#/grades')).toBe('/grades');
  });

  it('replaces what comes after the screen', () => {
    expect(routeShape('#/course/econ')).toBe('/course/:id');
    expect(routeShape('#/grades/econ')).toBe('/grades/:id');
  });

  /*
   * The one that matters. A course id is whatever the student's syllabus was
   * called, so the app cannot tell a mild one from a disclosing one — and must
   * therefore never pass either.
   */
  it('gives nothing away when the id is the disclosure', () => {
    const shape = routeShape('#/course/greek-orthodox-theology-seminar');
    expect(shape).toBe('/course/:id');
    expect(shape).not.toMatch(/theology/);
  });

  it('drops a query string, which is where the room key lives', () => {
    const shape = routeShape('#/classmates?room=vanderbilt/ECON%201020');
    expect(shape).toBe('/classmates');
    expect(shape).not.toMatch(/room|ECON|vanderbilt/);
  });

  it('replaces every later segment, not only the ones that look like ids', () => {
    // The rule is positional on purpose: an allowlist that has to recognise
    // the dangerous case fails on the route nobody told it about.
    expect(routeShape('#/a/b/c/d')).toBe('/a/:id');
  });

  it('answers /other for something it cannot read', () => {
    expect(routeShape('#/SCREAMING')).toBe('/other');
    expect(routeShape('#/123')).toBe('/other');
    expect(routeShape('#/a_b')).toBe('/other');
    expect(routeShape('#/' + 'x'.repeat(40))).toBe('/other');
  });

  it('answers / for no route at all', () => {
    expect(routeShape('')).toBe('/');
    expect(routeShape('#/')).toBe('/');
    expect(routeShape('#//////')).toBe('/');
  });

  it('reads a whole address, not only a hash', () => {
    expect(routeShape('https://example.com/semester/#/course/econ')).toBe('/course/:id');
  });

  /*
   * The control. Every assertion above is satisfied by a `routeShape` that
   * returns '/other' for everything — the shape of an over-broad redaction
   * that would make the field useless while looking careful.
   */
  it('still says which screen it was', () => {
    expect(routeShape('#/today')).toBe('/today');
    expect(routeShape('#/course/econ')).toBe('/course/:id');
    expect(routeShape('#/today')).not.toBe('/other');
  });

  it('never emits anything but the shape alphabet', () => {
    const wild = [
      '#/course/../../etc/passwd',
      '#/course/<script>alert(1)</script>',
      "#/course/o'brien",
      '#/course/one two three',
      '#/course/🙂',
      '#/today?token=sk-ant-secret',
    ];
    for (const href of wild) {
      expect(routeShape(href), href).toMatch(/^\/(?:[a-z][a-z-]{0,23}(?:\/:id)?|other)$/);
    }
  });

  it('carries no token even when one is in the address', () => {
    expect(routeShape('#/today?token=sk-ant-secret')).not.toMatch(/sk-ant|token|secret/);
  });
});

describe('the device is a class, not a fingerprint', () => {
  it('reads the viewport', () => {
    expect(deviceClass(390)).toBe('phone');
    expect(deviceClass(599)).toBe('phone');
    expect(deviceClass(600)).toBe('tablet');
    expect(deviceClass(1023)).toBe('tablet');
    expect(deviceClass(1024)).toBe('desktop');
    expect(deviceClass(2560)).toBe('desktop');
  });

  it('answers something usable for a width that makes no sense', () => {
    expect(deviceClass(0)).toBe('desktop');
    expect(deviceClass(-1)).toBe('desktop');
    expect(deviceClass(Number.NaN)).toBe('desktop');
  });
});

describe('the kinds', () => {
  it('offers five, each with a label', () => {
    expect(KINDS).toHaveLength(5);
    for (const k of KINDS) expect(k.label.length).toBeGreaterThan(0);
  });

  it('recognises its own and nothing else', () => {
    for (const k of KINDS) expect(isKind(k.id)).toBe(true);
    expect(isKind('urgent')).toBe(false);
    expect(isKind('')).toBe(false);
  });
});

describe('what can be sent', () => {
  it('refuses an empty note, and says what to do', () => {
    expect(sayable('')).toEqual({ ok: false, why: 'Say what happened first.' });
    expect(sayable('   ')).toEqual({ ok: false, why: 'Say what happened first.' });
  });

  it('takes a short report', () => {
    // Twenty-six characters and a good report. A minimum that turned this away
    // would be the form preferring its own tidiness to the information.
    expect(sayable('Back button does nothing').ok).toBe(true);
  });

  it('refuses one past the column, and counts it', () => {
    const long = 'x'.repeat(MOST + 1);
    const said = sayable(long);
    expect(said.ok).toBe(false);
    expect(said.why).toContain(String(MOST + 1));
  });

  it('takes one exactly at the limit', () => {
    expect(sayable('x'.repeat(MOST)).ok).toBe(true);
  });
});

describe('the context, and saying so', () => {
  it('collects the three things the app knows', () => {
    expect(context('#/course/econ', 390, 'abc1234')).toEqual({
      route: '/course/:id',
      device: 'phone',
      version: 'abc1234',
    });
  });

  it('copes with a build that stamped no version', () => {
    expect(context('#/today', 1440, '').version).toBe('');
  });

  it('shows the student everything that goes with it', () => {
    // Nothing about the report is collected unseen, which is the whole reason
    // this line exists rather than a footnote promising the same.
    const line = shownLine(context('#/course/econ', 390, 'abc1234'));
    expect(line).toBe('Sent with this: /course/:id · phone · abc1234');
  });

  it('leaves the version out of the line when there is none', () => {
    expect(shownLine(context('#/today', 1440, ''))).toBe('Sent with this: /today · desktop');
  });
});
