// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * A PDF added to the Study Studio, followed from the upload to the citation:
 * its pages become excerpts named by page, and a quotation from one opens the
 * original at that page. Files and extraction are stubbed — what is under test
 * is what the studio does with the pages `extract.ts` hands it.
 */

const mock = vi.hoisted(() => ({
  ask: vi.fn(),
  openFile: vi.fn(() => Promise.resolve(true)),
  extracted: {} as unknown,
}));
vi.mock('../state/store', () => ({
  useNow: () => new Date('2026-09-23T12:00:00Z'),
  useStore: () => ({
    state: { term: '2026FA', sample: false, reviews: {}, updates: [], notes: [] },
    catalog: { byId: { econ: { code: 'ECON', ai: { stance: 'allowed', note: '' } } } },
    dispatch: vi.fn(),
  }),
}));
vi.mock('../lib/live', () => ({ useLive: () => ({ guide: { code: 'ECON', source: 'Course guide', units: [] } }) }));
vi.mock('../lib/claude', () => ({ ask: mock.ask }));
vi.mock('../lib/assistant', () => ({ configured: () => true, routeLabel: () => 'test connection' }));
vi.mock('./Drawing', () => ({ Drawing: () => null }));
vi.mock('../lib/extract', async (actual) => ({
  ...(await actual<typeof import('../lib/extract')>()),
  extractText: () => Promise.resolve(mock.extracted),
}));
vi.mock('../lib/files', () => ({
  addFile: () => Promise.resolve({ id: 'f1' }),
  listFiles: () => Promise.resolve([]),
  getFile: () => Promise.resolve(undefined),
  openFile: mock.openFile,
  onFilesChanged: () => () => {},
}));
const { StudyStudio } = await import('./StudyStudio');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  localStorage.clear();
  mock.ask.mockReset();
  mock.openFile.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const button = (text: string | RegExp) =>
  [...host.querySelectorAll('button')].find((b) => (typeof text === 'string' ? b.textContent?.trim() === text : text.test(b.textContent ?? '')));

async function upload(name: string) {
  act(() => root.render(<StudyStudio courseId="econ" onClose={() => {}} />));
  const input = host.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [new File(['x'], name)], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function generate(sourceId: string, quote: string) {
  const consent = [...host.querySelectorAll('label')].find((l) => l.textContent?.includes('Send the selected text'))!;
  act(() => (consent.querySelector('input') as HTMLInputElement).click());
  mock.ask.mockResolvedValue(
    JSON.stringify({ sections: [{ format: 'comprehensive', title: 'Costs', body: 'About costs.', citations: [{ sourceId, quote }] }] }),
  );
  await act(async () => button('Create study guide')!.click());
}

it('names each PDF excerpt by its page, and opens a citation at that page', async () => {
  mock.extracted = {
    name: 'Chapter 1.pdf',
    text: 'Scarcity means choosing.\n\nThe opportunity cost of a choice is the value of the next best alternative.',
    words: 18,
    pageUnit: 'page',
    pages: [
      { page: 1, text: 'Scarcity means choosing.' },
      { page: 7, text: 'The opportunity cost of a choice is the value of the next best alternative.' },
    ],
  };
  await upload('Chapter 1.pdf');
  expect(host.textContent).toContain('2 source excerpts added');
  expect(host.textContent).toContain('Page 7');
  expect(host.textContent).not.toContain('page not recorded');

  await generate('upload-f1-7', 'the value of the next best alternative');
  expect(host.textContent).toContain('Chapter 1.pdf · Page 7');
  await act(async () => button('Open original at page 7')!.click());
  expect(mock.openFile).toHaveBeenCalledWith('f1', 7);
});

it('names a deck’s excerpts by slide, and does not promise to open a slide', async () => {
  // A browser opens a PDF at a page; it cannot open a .pptx at a slide.
  mock.extracted = {
    name: 'Session 7.pptx',
    text: 'Slide 3\nBuyers trade features off against price.',
    words: 8,
    pageUnit: 'slide',
    pages: [{ page: 3, text: 'Buyers trade features off against price.' }],
  };
  await upload('Session 7.pptx');
  expect(host.textContent).toContain('Slide 3');
  await generate('upload-f1-3', 'Buyers trade features off against price.');
  expect(button('Open original file')).toBeDefined();
  expect(button(/at page/)).toBeUndefined();
});

it('says which pages of a PDF had no readable text, rather than reading as a shorter file', async () => {
  mock.extracted = {
    name: 'Week 4.pdf',
    text: 'Title page',
    words: 2,
    pageUnit: 'page',
    pages: [{ page: 1, text: 'Title page' }],
    unread: [2, 3, 4, 5, 6],
    pageCount: 6,
  };
  await upload('Week 4.pdf');
  expect(host.textContent).toContain('1 source excerpt added.');
  expect(host.textContent).toContain('Week 4.pdf: 5 of 6 pages had no text that could be read (pages 2\u20136)');
  expect(host.textContent).toContain('probably scanned images');
});
