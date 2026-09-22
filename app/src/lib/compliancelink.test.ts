/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { safeUrl } from './apply';
import { CSC_URL, NIL_GO_URL } from './nil';

/**
 * The destination that matters most is the one no constant can hold.
 *
 * NIL Go and the College Sports Commission are national, so their addresses
 * are constants in `lib/nil.ts`. A compliance office is a different page at
 * every university, and it is the *first* place an athlete should go. Shipping
 * the two national links and a sentence saying "ask your compliance office"
 * makes the two that are clickable look like the answer.
 *
 * So the office gets a row with an empty address and a field to paste one
 * into, stored through `setLinkUrl` beside every other corrected address. This
 * file guards the three properties that make that honest rather than decorative.
 */

const SOURCE = readFileSync(new URL('../components/ComplianceLink.tsx', import.meta.url), 'utf8');

/*
 * Block comments only, and the reason is the trap this file fell into first.
 *
 * The markup scan below needs the docstring gone: it says the word `<a>` while
 * explaining why this component exists, and counting it reported an anchor
 * with no `rel` — a true reading of the prose and a false one about the page.
 * `withoutComments` in `styles/rules.ts` does that, so it was the obvious
 * tool.
 *
 * **It also blanks every URL.** Its second pass treats `//` as the start of a
 * line comment, which is right for code and wrong for `https://` — so a URL
 * written into the component disappears before the scan sees it, and the
 * hardcoded-address guard below could never fail. Measured: an injected
 * `https://compliance.vanderbilt.edu` left `urls` empty and the test green.
 *
 * That is the failure `CLAUDE.md` describes as a claim about the probe — the
 * first teardown probe here "found" six leaks and the second reported a
 * leaking file clean, both because the measurement answered a narrower
 * question than the one asked. So the URL scan reads the raw source, where a
 * literal address cannot hide, and only the markup scan strips.
 */
const BLOCKS_STRIPPED = SOURCE.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const NIL_SCREEN = readFileSync(new URL('../screens/Nil.tsx', import.meta.url), 'utf8');

describe('the compliance link', () => {
  /*
   * The whole point. A hardcoded address here would be a guess about which
   * university this student attends, presented as a link they would press.
   */
  it('hardcodes no university address', () => {
    // Raw source: see the note above on why the stripped copy cannot be used here.
    const urls = [...SOURCE.matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => m[0]);
    const foreign = urls.filter((u) => u !== NIL_GO_URL && u !== CSC_URL && !u.startsWith('https://…'));
    expect(foreign, `an address was written into the component: ${foreign.join(', ')}`).toEqual([]);
  });

  it('files the address under an id the Links screen can share', () => {
    expect(SOURCE).toContain("export const COMPLIANCE_LINK = 'athletics-compliance'");
    expect(SOURCE).toContain("type: 'setLinkUrl'");
  });

  /*
   * A pasted address goes through `safeUrl`, which is what stops
   * `javascript:` reaching an anchor's href. The component is the only new
   * place in this feature that takes a URL from a person and renders it.
   */
  it('passes what was typed through safeUrl before storing it', () => {
    expect(SOURCE).toContain('safeUrl(draft)');
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('compliance.example.edu')).toBe('https://compliance.example.edu/');
    expect(safeUrl('')).toBe('');
  });

  it('opens every outward link in a new tab without handing over the opener', () => {
    const anchors = [...BLOCKS_STRIPPED.matchAll(/<a\b[\s\S]*?>/g)].map((m) => m[0]);
    expect(anchors.length).toBeGreaterThanOrEqual(3);
    for (const a of anchors) {
      expect(a, `an anchor is missing rel=noreferrer: ${a.slice(0, 60)}`).toContain('noreferrer');
      expect(a).toContain("target=\"_blank\"");
    }
  });

  /*
   * One home for these three, so the screen cannot grow a second row of the
   * same links somewhere further down.
   */
  it('is the only place the NIL screen draws them', () => {
    expect(NIL_SCREEN).toContain('<ComplianceLink />');
    expect(NIL_SCREEN).not.toContain('NIL_GO_URL');
    expect(NIL_SCREEN).not.toContain('CSC_URL');
  });
});
