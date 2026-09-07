import { describe, expect, it } from 'vitest';
import { MARK, NEEDS_BACK, SNIPPET, withBackLink } from './webback';

const page = (body = '<div>the term</div>') => `<!DOCTYPE html><html><body>${body}</body></html>`;

describe('the return link added to the website at build time', () => {
  it('goes in before the closing body tag', () => {
    const out = withBackLink(page());
    expect(out).toContain(MARK);
    expect(out.indexOf(MARK)).toBeLessThan(out.indexOf('</body>'));
    // And leaves the page it was given intact.
    expect(out).toContain('<div>the term</div>');
  });

  it('is idempotent, so two builds do not make two buttons', () => {
    const once = withBackLink(page());
    expect(withBackLink(once)).toBe(once);
  });

  it('refuses a file it does not recognise rather than appending to the end', () => {
    // A bundle with no closing body tag is not one of the three website
    // pages, and appending to the end of something unrecognised is how a
    // build step corrupts a deploy.
    const odd = '<!DOCTYPE html><html><p>not a page we know';
    expect(withBackLink(odd)).toBe(odd);
  });

  it('takes the last closing body tag, not one inside the bundled string', () => {
    // These files carry the real document as an escaped string, which contains
    // its own `</body>`. Only the outer one is the real end of the file.
    const nested = `<!DOCTYPE html><html><body><script>var d = "<\\u002Fbody>";</script></body></html>`;
    const out = withBackLink(nested);
    expect(out.indexOf(MARK)).toBeGreaterThan(out.indexOf('<script>'));
    expect(out.endsWith('</body></html>')).toBe(true);
  });

  it('computes the app address from the page it is on', () => {
    // Not a hardcoded github.io URL, which is what the front door has and what
    // makes its link home wrong on a fork or a local preview.
    expect(SNIPPET).toContain("lastIndexOf('/web/')");
    expect(SNIPPET).not.toMatch(/https?:\/\//);
  });

  it('re-attaches, because the bundler replaces the document as it unpacks', () => {
    expect(SNIPPET).toContain('MutationObserver');
  });

  it('is for the two pages that have no way back, not the front door', () => {
    // index.html already links to the app twice. A third would be clutter on
    // the one page that does not need it.
    expect(NEEDS_BACK).toEqual(['app.html', 'study.html']);
  });
});
