import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ASK_NEED_IDS, URGENT_SAFETY_TEXT, needs } from '../lib/ask-human';
import { AskAHuman } from './AskAHuman';

describe('AskAHuman', () => {
  const html = renderToStaticMarkup(<AskAHuman />);

  it('puts the safety line first, outside every disclosure', () => {
    const at = html.indexOf(URGENT_SAFETY_TEXT.slice(0, 40));
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(html.indexOf('<details'));
    expect(at).toBeLessThan(html.indexOf('Academic planning'));
  });

  it('lists all ten needs with contact, what to bring, official source and getting ready', () => {
    expect((html.match(/<details/g) ?? []).length).toBe(ASK_NEED_IDS.length);
    for (const n of needs()) {
      expect(html).toContain(`<summary>${n.label}</summary>`);
    }
    expect((html.match(/Contact: /g) ?? []).length).toBe(10);
    expect((html.match(/Official source: /g) ?? []).length).toBe(10);
    expect((html.match(/Getting ready/g) ?? []).length).toBe(10);
    expect(html).toContain('What to bring');
  });

  it('says where Semester only points, and repeats the safety text with personal support', () => {
    expect(html).toContain('Semester only points to this office');
    const personal = html.slice(html.indexOf('Personal support</summary>'));
    expect(personal.slice(0, personal.indexOf('</details>'))).toContain(URGENT_SAFETY_TEXT.slice(0, 40));
  });
});
