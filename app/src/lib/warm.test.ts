/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { bootAssets } from './warm';

/**
 * What the page has to ask for again, so the worker's cache gets it.
 *
 * Measured against the production build before this existed: a first visit
 * followed by going offline left `#root` empty, with the entry bundle and
 * four of its static imports failing, because none of them had ever passed
 * through a fetch handler that did not exist while they were being loaded.
 */
const page = (html: string): Document => {
  const doc = document.implementation.createHTMLDocument('t');
  const base = doc.createElement('base');
  base.href = 'https://app.example/semester/';
  doc.head.append(base);
  doc.head.insertAdjacentHTML('beforeend', html);
  return doc;
};

describe('the assets a page booted from', () => {
  it('finds the entry script, its preloads and the stylesheet', () => {
    const doc = page(`
      <script type="module" crossorigin src="/semester/assets/index-a.js"></script>
      <link rel="modulepreload" crossorigin href="/semester/assets/runtime-b.js">
      <link rel="stylesheet" href="/semester/assets/index-c.css">
    `);
    expect(bootAssets(doc, 'https://app.example')).toEqual([
      'https://app.example/semester/assets/index-a.js',
      'https://app.example/semester/assets/runtime-b.js',
      'https://app.example/semester/assets/index-c.css',
    ]);
  });

  it('leaves another origin alone', () => {
    // The worker refuses anything off this origin, so re-fetching it would be
    // a second request that helps nobody.
    const doc = page(`
      <script src="https://cdn.example/analytics.js"></script>
      <link rel="stylesheet" href="https://fonts.example/x.css">
      <script type="module" src="/semester/assets/index-a.js"></script>
    `);
    expect(bootAssets(doc, 'https://app.example')).toEqual([
      'https://app.example/semester/assets/index-a.js',
    ]);
  });

  it('resolves a relative path against the document, not the test', () => {
    // Pages serves the app from a sub-path, so this is the ordinary case
    // rather than the exotic one.
    const doc = page('<script type="module" src="assets/index-a.js"></script>');
    expect(bootAssets(doc, 'https://app.example')).toEqual([
      'https://app.example/semester/assets/index-a.js',
    ]);
  });

  it('asks for each one once, however many tags name it', () => {
    const doc = page(`
      <link rel="modulepreload" href="/semester/assets/a.js">
      <script type="module" src="/semester/assets/a.js"></script>
    `);
    expect(bootAssets(doc, 'https://app.example')).toHaveLength(1);
  });

  it('skips a link that is neither a preload nor a stylesheet', () => {
    // The icon and the manifest are the worker's own shell already, and a
    // preconnect names an origin rather than a file.
    const doc = page(`
      <link rel="icon" href="/semester/icon.svg">
      <link rel="manifest" href="/semester/manifest.webmanifest">
      <link rel="preconnect" href="https://fonts.example">
      <script type="module" src="/semester/assets/a.js"></script>
    `);
    expect(bootAssets(doc, 'https://app.example')).toEqual([
      'https://app.example/semester/assets/a.js',
    ]);
  });

  it('is empty for a page with nothing on it', () => {
    expect(bootAssets(page(''), 'https://app.example')).toEqual([]);
  });
});
