// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The public front door has a lot of depth, but the global frame must not make
 * a first-time student or buyer choose among the whole sitemap at once.
 * Contextual pages and search carry the long tail; the header and footer carry
 * the six routes that answer the first visit.
 */

const root = join(import.meta.dirname, '../../..');
const markup = readFileSync(join(root, 'company-site/index.html'), 'utf8');
const script = readFileSync(join(root, 'company-site/site.js'), 'utf8');
const site = [
  markup,
  script,
].join('\n');

const between = (start: string, end: string) => {
  const from = site.indexOf(start);
  return site.slice(from, site.indexOf(end, from));
};

describe('the company site global navigation', () => {
  it('offers six direct audience and decision paths without mega menus', () => {
    const header = between('<nav class="nav-main"', '</nav>');
    const links = [...header.matchAll(/<a href="(#[^"]+)">([^<]+)<\/a>/g)]
      .map(([, href, label]) => [label, href]);

    expect(links).toEqual([
      ['Product', '#product'],
      ['Students', '#students'],
      ['Institutions', '#institutions'],
      ['Pricing', '#pricing'],
      ['Resources', '#tools'],
      ['Trust', '#trust'],
    ]);
    expect(header).not.toContain('button class="dd"');
    expect(site).toContain('document.querySelectorAll(".nav-main>a").forEach');
    expect(site).toContain('a.setAttribute("aria-current","page")');
  });

  it('keeps the mobile menu focused and moves the full sitemap behind search', () => {
    const drawer = between('<div class="drawer"', '</div>\n</div>');

    expect(drawer).toContain('<p class="grp">Explore Semester</p>');
    expect(drawer).toContain('<a href="#tools">Resources</a>');
    expect(drawer).toContain('Search the complete site');
    expect(drawer).toContain('<template id="legacy-mobile-navigation">');
  });

  it('keeps the footer useful without reproducing the entire sitemap', () => {
    const footer = between('<footer>', '</footer>');
    const headings = [...footer.matchAll(/<h2 class="fh">([^<]+)<\/h2>/g)].map((match) => match[1]);
    const links = [...footer.matchAll(/<a\b/g)];

    expect(headings).toEqual(['Product', 'Students', 'Institutions', 'Resources', 'Trust']);
    expect(links.length).toBeLessThanOrEqual(36);
    expect(footer).toContain('Search the complete site');
  });
});

// Schedule names come directly from visitor input. Run the shipped parser,
// renderer, styles and input listeners against its real markup, not a replica.
const section = (source: string, start: string, end: string) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Company schedule section missing: ${start}`);
  return source.slice(from, to);
};
const runtimeSource = section(script, 'const runtimeRules=', '// ---------- data ----------');
const escapeSource = section(script, 'const esc=', 'const tiles=');
const inputSource = section(script, 'const v=', 'function agenda(');
const scheduleSource = section(script, '// ---------- build my semester ----------', '// ---------- launch estimator ----------');
const scheduleMarkup = section(markup, '<div data-page="build-my-semester"', '<div data-page="launch-estimator"');

describe('the company site visitor-entered schedule', () => {
  let fixture: HTMLDivElement;
  let style: HTMLStyleElement;
  let previousClipboard: PropertyDescriptor | undefined;

  const input = (id: string) => document.getElementById(id) as HTMLTextAreaElement;
  const blocks = () => [...document.querySelectorAll<HTMLElement>('#bp-week .blkc')];
  const update = (courses: string, commitments = '') => {
    input('bp-courses').value = courses;
    input('bp-commit').value = commitments;
    input('bp-courses').dispatchEvent(new Event('input', { bubbles: true }));
  };

  beforeEach(() => {
    previousClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    fixture = document.createElement('div');
    fixture.innerHTML = scheduleMarkup;
    document.body.append(fixture);
    style = document.createElement('style');
    document.head.append(style);
    // jsdom's embedded sheets omit href; provide only the native sheet identity
    // needed by the shipped external-stylesheet lookup. Rule insertion is real.
    Object.defineProperty(style.sheet!, 'href', { value: 'https://www.semester.website/site.css' });
    new Function('document', 'location', 'navigator', `
      ${runtimeSource}
      ${escapeSource}
      ${inputSource}
      ${scheduleSource}
    `)(document, window.location, navigator);
  });

  afterEach(() => {
    fixture.remove();
    style.remove();
    if (previousClipboard) Object.defineProperty(navigator, 'clipboard', previousClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
    vi.restoreAllMocks();
  });

  const hostileNames = [
    'Study " data-injected="owned',
    'Study " onmouseover="window.__scheduleInjected = true',
    'Study " tabindex="0',
  ];

  it.each(hostileNames)('keeps a course name as literal text and title: %s', name => {
    update(`${name}, M, 10:00-11:00, 3`);
    expect(blocks()).toHaveLength(1);
    const block = blocks()[0];
    expect(block.getAttributeNames().sort()).toEqual(['class', 'title']);
    expect(block.title).toBe(name);
    expect(block.querySelector('b')!.textContent).toBe(name.split(' ').slice(0, 2).join(' '));
    expect(block.querySelectorAll('*')).toHaveLength(2); // b and br only
  });

  it.each(hostileNames)('keeps a commitment name as literal text and title: %s', name => {
    update('', `${name}, TR, 16:00-18:00`);
    expect(blocks()).toHaveLength(2);
    for (const block of blocks()) {
      expect(block.getAttributeNames().sort()).toEqual(['class', 'title']);
      expect(block.title).toBe(name);
      expect(block.querySelectorAll('*')).toHaveLength(2);
    }
  });

  it.each([
    'Research & Design <Intro>',
    "O'Connor's seminar — 日本語",
    'Literal &quot; character',
  ])('preserves special characters without interpreting HTML: %s', name => {
    update(`${name}, MW, 10:00-11:00, 3`);
    expect(blocks()).toHaveLength(2);
    for (const block of blocks()) {
      expect(block.title).toBe(name);
      expect(block.querySelector('b')!.textContent).toBe(name.split(' ').slice(0, 2).join(' '));
      expect(block.getAttributeNames().sort()).toEqual(['class', 'title']);
      expect(block.querySelectorAll('*')).toHaveLength(2);
    }
  });

  it('preserves the default grid, conflict markers, block positions and hours', () => {
    expect([...document.querySelectorAll('#bp-week .wk-h')].map(node => node.textContent))
      .toEqual(['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(blocks()).toHaveLength(14);
    expect(document.querySelectorAll('#bp-week .blkc.bad')).toHaveLength(6);
    expect([...document.querySelectorAll('#bp-week .wk-d')].map(column => column.children.length))
      .toEqual([3, 3, 3, 3, 2]);
    const first = blocks()[0];
    expect(first.title).toBe('ECON 2100 Intermediate Micro');
    expect(first.textContent).toBe('ECON 210010:10am');
    expect(window.getComputedStyle(first).top).toBe('86.67px');
    expect(window.getComputedStyle(first).height).toBe('33.33px');
  });

  it('rerenders through the existing form listener and keeps submission local', () => {
    const form = document.getElementById('bp-form')!;
    update('First course, M, 10:00-11:00, 3');
    const previousBlock = blocks()[0];
    update('Second course, F, 12:00-13:00, 4');
    expect(previousBlock.isConnected).toBe(false);
    expect(blocks()).toHaveLength(1);
    expect(blocks()[0].title).toBe('Second course');
    expect(blocks()[0].textContent).toBe('Second course12pm');
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
  });

  it('copies the original complete names through the existing copy listener', async () => {
    const name = 'Study " & <notes>';
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    update(`${name}, M, 10:00-11:00, 3`);
    document.getElementById('bp-copy')!.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`- ${name}: M 10am-11am (3 cr)`));
    expect(document.getElementById('bp-copied')!.textContent).toBe('Copied to clipboard.');
  });
});
