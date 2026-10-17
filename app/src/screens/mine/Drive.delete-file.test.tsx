// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../../data/seed';
import { StoreProvider } from '../../state/store';
import { Drive } from './Drive';

const files = vi.hoisted(() => ({
  sweepTrash: vi.fn(async () => 2),
  deleteFile: vi.fn(async () => undefined),
  purgeTrash: vi.fn(async () => 2),
  listTrash: vi.fn(async () => [
    { id: 'syllabus', name: 'Syllabus.pdf', type: 'application/pdf', size: 2048, added: 1, courseId: 'course-1', folderId: null, starred: false, trashedAt: 2, openedAt: null, itemId: 'deadline-1' },
    { id: 'notes', name: 'Notes.txt', type: 'text/plain', size: 1024, added: 2, courseId: null, folderId: null, starred: false, trashedAt: 3, openedAt: null, itemId: null },
  ]),
}));

vi.mock('../../lib/files', () => ({
  TRASH_DAYS: 30,
  addFile: vi.fn(),
  sweepTrash: files.sweepTrash,
  deleteFile: files.deleteFile,
  purgeTrash: files.purgeTrash,
  emptyTrash: vi.fn(),
  formatBytes: (size: number) => size >= 1024 ? `${Math.round(size / 1024)} KB` : `${size} B`,
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
  await act(async () => (await Promise.resolve()));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Drive permanent file deletion', () => {
  it('reports automatic retention deletion and gives a failed sweep a recovery path', async () => {
    expect(host.querySelector('[role="status"]')?.textContent).toContain('permanently removed 2 files');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('30 days');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('cannot be restored');

    await act(async () => root.unmount());
    files.sweepTrash.mockRejectedValueOnce(new Error('storage refused'));
    root = createRoot(host);
    await act(async () => root.render(<StoreProvider><Drive /></StoreProvider>));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('could not finish the 30-day bin cleanup');
    expect(alert?.textContent).toContain('see what remains');
  });

  it('names the exact irreversible loss and does not delete on the first press or cancel', async () => {
    await click('Delete Syllabus.pdf for good. This cannot be undone.');

    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Delete Syllabus.pdf for good?');
    expect(dialog?.textContent).toContain('the only copy of Syllabus.pdf that Semester keeps on this device');
    expect(dialog?.textContent).toContain('2 KB');
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

  it('previews the exact bulk loss and leaves the bin untouched on cancel', async () => {
    await click('Empty the bin — 2 files, deleted for good');

    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Empty the bin?');
    expect(dialog?.textContent).toContain('2 files currently in the bin');
    expect(dialog?.textContent).toContain('3 KB of stored bytes');
    expect(dialog?.textContent).toContain('Files added to the bin after this preview opened are not deleted');
    expect(dialog?.textContent).toContain('Course, deadline and note links are not deleted');
    expect(dialog?.textContent).toContain('workspace backup cannot restore these bytes');
    expect(files.purgeTrash).not.toHaveBeenCalled();

    await click('Keep it');
    expect(files.purgeTrash).not.toHaveBeenCalled();
  });

  it('requires the bulk phrase and deletes only the files named by the preview', async () => {
    await click('Empty the bin — 2 files, deleted for good');

    const dialog = host.querySelector('[role="dialog"]') as HTMLElement;
    const confirm = [...dialog.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === 'Delete all') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    const input = dialog.querySelector('input') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'EMPTY BIN');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(confirm.disabled).toBe(false);

    await act(async () => confirm.click());
    expect(files.purgeTrash).toHaveBeenCalledTimes(1);
    expect(files.purgeTrash).toHaveBeenCalledWith(['syllabus', 'notes']);
  });
});
