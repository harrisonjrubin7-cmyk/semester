// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../../data/seed';
import { StoreProvider } from '../../state/store';
import { Drive } from './Drive';

const files = vi.hoisted(() => ({
  deleteFile: vi.fn(async () => undefined),
  listTrash: vi.fn(async () => [
    { id: 'syllabus', name: 'Syllabus.pdf', type: 'application/pdf', size: 2048, added: 1, courseId: 'course-1', folderId: null, starred: false, trashedAt: 2, openedAt: null, itemId: 'deadline-1' },
  ]),
}));

vi.mock('../../lib/files', () => ({
  TRASH_DAYS: 30,
  addFile: vi.fn(),
  sweepTrash: vi.fn(async () => undefined),
  deleteFile: files.deleteFile,
  emptyTrash: vi.fn(),
  formatBytes: (size: number) => `${size} bytes`,
  listFiles: vi.fn(async () => []),
  listTrash: files.listTrash,
  moveFile: vi.fn(),
  openFile: vi.fn(),
  restoreFile: vi.fn(),
  search: vi.fn((rows: Array<Record<string, unknown>>) => rows.map((file) => ({ file, inText: false }))),
  pinFile: vi.fn(),
  starFile: vi.fn(),
  tagFile: vi.fn(),
  trashFile: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const button = (name: string): HTMLButtonElement => {
  const found = [...host.querySelectorAll('button')].find((candidate) =>
    candidate.getAttribute('aria-label') === name || candidate.textContent?.trim() === name,
  );
  expect(found, `No button named ${name}`).toBeTruthy();
  return found as HTMLButtonElement;
};

const click = async (name: string) => {
  await act(async () => button(name).click());
};

beforeAll(async () => {
  window.matchMedia = (() => ({
    matches: false,
    media: '',
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  await loadSeed();
});

beforeEach(async () => {
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<StoreProvider><Drive /></StoreProvider>));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await click('Bin');
  await act(async () => void (await Promise.resolve()));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Drive permanent file deletion', () => {
  it('names the exact irreversible loss and does not delete on the first press or cancel', async () => {
    await click('Delete Syllabus.pdf for good. This cannot be undone.');

    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Delete Syllabus.pdf for good?');
    expect(dialog?.textContent).toContain('the only copy of Syllabus.pdf that Semester keeps on this device');
    expect(dialog?.textContent).toContain('2048 bytes');
    expect(dialog?.textContent).toContain('course, deadline and note links are not deleted');
    expect(dialog?.textContent).toContain('workspace backup cannot restore these bytes');
    expect(files.deleteFile).not.toHaveBeenCalled();

    await click('Keep it');
    expect(files.deleteFile).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('requires the exact file name before deleting only that binned record', async () => {
    await click('Delete Syllabus.pdf for good. This cannot be undone.');

    const dialog = host.querySelector('[role="dialog"]') as HTMLElement;
    const confirm = [...dialog.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === 'Delete for good') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    const input = dialog.querySelector('input') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Syllabus.pdf');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(confirm.disabled).toBe(false);

    await act(async () => confirm.click());
    expect(files.deleteFile).toHaveBeenCalledTimes(1);
    expect(files.deleteFile).toHaveBeenCalledWith('syllabus');
  });
});
