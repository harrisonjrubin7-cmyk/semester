import { describe, expect, it } from 'vitest';
import { newCreation, readCreations } from './creations';
import { TEMPLATES, apply, templateFor } from './designtemplates';

/**
 * The check that matters here is not that a template looks right — a
 * screenshot is for that — but that the app can read back what it makes.
 *
 * `readCreations` refuses a design whose numbers are out of range: a layer
 * wider than 2,400, a font size under 8, a colour that is not a colour, two
 * layers sharing an id, more than sixty layers, a canvas under 200 a side. A
 * template that produced one would be a project this app could create and then
 * refuse to load, which is the worst failure a starting point can have and the
 * one that would not show until somebody reopened their work.
 *
 * So every template goes through the real reader rather than through a
 * restatement of its rules. A restatement can drift from the rule; the rule
 * cannot drift from itself.
 */

/** A project carrying this template's canvas, through the library's own shape. */
const projectFrom = (id: string) => {
  const t = templateFor(id)!;
  const project = newCreation('design');
  project.design = apply(t);
  return { version: 1, projects: [project] };
};

describe('every design template', () => {
  it('there are some, so the rules below hold something', () => {
    expect(TEMPLATES.length).toBeGreaterThan(0);
  });

  for (const t of TEMPLATES) {
    describe(t.name, () => {
      it('is readable by the app that has to reopen it', () => {
        expect(() => readCreations(projectFrom(t.id))).not.toThrow();
      });

      it('gives every layer an id of its own', () => {
        const layers = apply(t).layers;
        expect(new Set(layers.map((l) => l.id)).size).toBe(layers.length);
      });

      it('does not hand two designs the same ids', () => {
        // Applying twice must not produce a pair of projects that collide, and
        // `newLayer` is what makes that true rather than a counter here.
        const a = apply(t).layers.map((l) => l.id);
        const b = apply(t).layers.map((l) => l.id);
        expect(a.some((id) => b.includes(id))).toBe(false);
      });

      it('keeps every layer on the canvas it was drawn for', () => {
        const canvas = apply(t);
        for (const l of canvas.layers) {
          expect(l.x, `${l.text || l.kind} starts off the left`).toBeGreaterThanOrEqual(0);
          expect(l.y, `${l.text || l.kind} starts off the top`).toBeGreaterThanOrEqual(0);
          expect(l.x, `${l.text || l.kind} starts past the right edge`).toBeLessThanOrEqual(canvas.width);
          expect(l.y, `${l.text || l.kind} starts past the bottom`).toBeLessThanOrEqual(canvas.height);
        }
      });

      it('says what it is for, so a menu of eight is readable', () => {
        expect(t.name.length).toBeGreaterThan(2);
        expect(t.about.length).toBeGreaterThan(10);
      });

      it('has no line wider than the box it is in', () => {
        /*
         * `designSvg` draws one `<text>` per layer with a `<tspan>` per
         * newline. There is no line box, so a sentence longer than its `w`
         * runs off the side of the poster — which is what the flyer's first
         * draft did, with every number in it inside every range the reader
         * checks.
         *
         * Arial's average advance is about half its point size. That is an
         * approximation and this is deliberately generous with it: the failure
         * being caught is a line half again too long, not one two pixels over.
         */
        for (const l of apply(t).layers) {
          if (l.kind !== 'text') continue;
          for (const line of l.text.split('\n')) {
            const guess = line.length * l.fontSize * 0.5;
            expect(guess, `“${line}” is wider than its ${l.w}px box`).toBeLessThanOrEqual(l.w * 1.1);
          }
        }
      });

      it('keeps its text off the edge of the paper', () => {
        // The title card's first draft put its headline at x: 0, flush against
        // the left edge of the slide. Nothing in the reader objects to zero —
        // it is inside the canvas — so the guard has to be here.
        const canvas = apply(t);
        const margin = Math.min(canvas.width, canvas.height) * 0.04;
        for (const l of canvas.layers) {
          if (l.kind !== 'text') continue;
          expect(l.x, `“${l.text.split('\n')[0]}” is against the left edge`).toBeGreaterThanOrEqual(margin);
        }
      });

      it('has something on it', () => {
        expect(apply(t).layers.length).toBeGreaterThan(1);
      });
    });
  }

  it('has no two templates sharing an id', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });

  it('answers with nothing for an id it does not have', () => {
    expect(templateFor('not-a-template')).toBeNull();
  });

  it('starts a fresh canvas rather than half-replacing one', () => {
    // A template over an old background at the old size is the confusing state
    // this avoids by not having it.
    const t = templateFor('title')!;
    const canvas = apply(t);
    expect(canvas.background).toBe(t.background);
    expect(canvas.width).toBe(t.width);
    expect(canvas.height).toBe(t.height);
  });
});
