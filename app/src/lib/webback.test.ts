import { describe, expect, it } from 'vitest';
import {
  MARK,
  NEEDS_BACK,
  PAGES,
  PATHS,
  PATH_SNIPPET,
  SNIPPET,
  SOURCE_PREFIX,
  withBackLink,
  withPathFix,
} from './webback';

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

describe('the source-tree paths the generator leaked into the pages', () => {
  const head = (extra = '') =>
    `<!DOCTYPE html><html><head><title>Bundled Page</title>${extra}</head><body>x</body></html>`;

  it('goes in the head, before the script that unpacks the document', () => {
    // A patch applied after the first fetch has gone out is not a patch: the
    // study page asks for its units immediately and swallows the 404.
    const out = withPathFix(head());
    expect(out).toContain(PATHS);
    expect(out.indexOf(PATHS)).toBeLessThan(out.indexOf('</head>'));
  });

  it('is idempotent, so two builds do not patch fetch twice', () => {
    const once = withPathFix(head());
    expect(withPathFix(once)).toBe(once);
  });

  it('refuses a file with no head rather than guessing where to put it', () => {
    const odd = '<!DOCTYPE html><html><p>not a page we know';
    expect(withPathFix(odd)).toBe(odd);
  });

  it('takes the outer head, not one inside the bundled string', () => {
    // The real document is carried as an escaped string and has its own head.
    // The outer one closes first, which is also the only place early enough.
    const nested =
      '<!DOCTYPE html><html><head><title>Bundled Page</title></head>' +
      '<body><script>var d = "<head>the real one</head>";</script></body></html>';
    const out = withPathFix(nested);
    expect(out.indexOf(PATHS)).toBeLessThan(out.indexOf('var d'));
  });

  it('names the prefix that must not survive into a URL', () => {
    // Vite publishes the contents of public/, so `app/public/` is where a file
    // sits in the repository and never part of where it is served from.
    expect(SOURCE_PREFIX).toBe('app/public/');
    expect(PATH_SNIPPET).toContain(SOURCE_PREFIX);
  });

  it('computes the base from the page it is on, like the return link does', () => {
    expect(PATH_SNIPPET).toContain("lastIndexOf('/web/')");
    expect(PATH_SNIPPET).not.toMatch(/https?:\/\//);
  });

  it('covers the three ways a bad path reaches the network', () => {
    // A string to fetch, a Request already built, an XHR, and a src attribute
    // the page sets on an element. study.html uses the first, app.html the last.
    expect(PATH_SNIPPET).toContain('window.fetch');
    expect(PATH_SNIPPET).toContain('XMLHttpRequest.prototype.open');
    expect(PATH_SNIPPET).toContain('MutationObserver');
    expect(PATH_SNIPPET).toContain("['src', 'href']");
  });

  it('goes on all three pages, unlike the return link', () => {
    // The front door needs no way back and still must not ask for a path that
    // only exists in the repository.
    expect(PAGES).toEqual(['index.html', 'app.html', 'study.html']);
  });
});

describe('what the snippet does to a URL, run as the browser would run it', () => {
  /** The snippet's own `fix`, lifted out and given a page to sit on. */
  const fix = (url: string, page = '/semester/web/study.html') => {
    const PRE = SOURCE_PREFIX;
    const root = () => {
      const cut = page.lastIndexOf('/web/');
      return `${cut === -1 ? '' : page.slice(0, cut)}/`;
    };
    if (url.slice(0, PRE.length) === PRE) return root() + url.slice(PRE.length);
    const at = url.indexOf(`/web/${PRE}`);
    if (at !== -1) return `${url.slice(0, at)}/${url.slice(at + 5 + PRE.length)}`;
    return url;
  };

  it('sends the study page’s units to where Vite actually published them', () => {
    expect(fix('app/public/audio/lessons/econ/lessons.json')).toBe(
      '/semester/audio/lessons/econ/lessons.json',
    );
  });

  it('mends it after the browser has already resolved it', () => {
    expect(fix('https://x.example/semester/web/app/public/icon.svg')).toBe(
      'https://x.example/semester/icon.svg',
    );
  });

  it('is right under any base, not just /semester/', () => {
    expect(fix('app/public/icon.svg', '/web/app.html')).toBe('/icon.svg');
    expect(fix('app/public/icon.svg', '/a/fork/web/app.html')).toBe('/a/fork/icon.svg');
  });

  it('leaves every other URL exactly as it was', () => {
    for (const u of [
      'https://harrisonjrubin7-cmyk.github.io/semester/#/home',
      './study.html',
      'data:image/svg+xml,<svg/>',
      '/semester/audio/lessons/econ/lessons.json',
      'apple-touch-icon.png',
    ]) {
      expect(fix(u), u).toBe(u);
    }
  });
});
