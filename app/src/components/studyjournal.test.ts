import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The journal's buttons look like the app's buttons.
 *
 * `features.css` styles a bare `<button>` as `.portal-workspace button` —
 * forty pixels of minimum height, an eight pixel radius, the accent wash, no
 * uppercase. That scope is the whole reason the portal features can write
 * `<button>` with no class at all, and seven of them here did.
 *
 * This panel took `.portal-panel` for its frame and `.input` for its fields,
 * so its selects and textareas looked right, and never took the wrapper. Its
 * buttons therefore matched no rule: on the deployed build they rendered as
 * user-agent defaults — grey, square-cornered, a two-pixel bevel, twenty-one
 * pixels tall — in the middle of a screen where every other control is a
 * rounded pill. Measured beside them on the same screen: background
 * rgb(107,107,107) against rgb(18,20,26), radius 0 against 8, height 21
 * against 40.
 *
 * Every other portal feature wraps itself in the class. Two — `CampusDirectory`
 * and `RegistrationPortal` — do not and are fine, because they are only ever
 * mounted inside a screen that provides it. This one is mounted bare on Study,
 * which is what made it the only one showing.
 *
 * Checked by reading the files, because the failure is a missing class: it
 * throws nothing, types fine, and looks like a styling opinion rather than a
 * bug to anybody who has not seen the rest of the app.
 */
const JOURNAL = readFileSync(new URL('./StudyJournal.tsx', import.meta.url), 'utf8');
const SHEET = readFileSync(new URL('../styles/features.css', import.meta.url), 'utf8');

describe('the study journal', () => {
  it('is inside the scope that styles a classless button', () => {
    const root = JOURNAL.match(/return <details className="([^"]*)"/);
    expect(root, 'the journal no longer opens with a <details> root').toBeTruthy();
    expect(root![1].split(/\s+/)).toContain('portal-workspace');
  });

  it('keeps the panel frame it already had', () => {
    const root = JOURNAL.match(/return <details className="([^"]*)"/);
    expect(root![1].split(/\s+/)).toContain('portal-panel');
  });

  it('needs the wrapper only while the button rule is scoped to it', () => {
    // If this ever fails, the rule has been unscoped and the wrapper above is
    // no longer load-bearing — which is a fine outcome, and a deliberate one
    // to make rather than to discover.
    expect(SHEET).toMatch(/\.portal-workspace button[^{]*\{[^}]*min-height:\s*40px/);
  });
});
