// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../../data/seed';
import { STORAGE_KEY } from '../../state/shape';
import { StoreProvider } from '../../state/store';
import { Drive } from './Drive';

const files = vi.hoisted(() => ({
  listFiles: vi.fn(async () => [
    { id: 'brief', name: 'Brief.pdf', type: 'application/pdf', size: 10, added: 1, courseId: null, folderId: 'research', starred: false, trashedAt: null, openedAt: null, itemId: null },
    { id: 'notes', name: 'Notes.txt', type: 'text/plain', size: 20, added: 2, courseId: null, folderId: 'interviews', starred: false, trashedAt: null, openedAt: null, itemId: null },
  ]),
  listTrash: vi.fn(async () => []),
  moveFile: vi.fn(async () => undefined),
}));

vi.mock('../../lib/files', () => ({
  TRASH_DAYS: 30,
  addFile: vi.fn(),
  sweepTrash: vi.fn(async () => undefined),
  deleteFile: vi.fn(),
  emptyTrash: vi.fn(),
  formatBytes: (size: number) => `${size} bytes`,
  listFiles: files.listFiles,
  listTrash: files.listTrash,
  moveFile: files.moveFile,
  openFile: vi.fn(),
  restoreFile: vi.fn(),
  search: vi.fn(() => []),
  pinFile: vi.fn(),
  starFile: vi.fn(),
  tagFile: vi.fn(),
  trashFile: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const click = async (name: string) => {
  const button = [...host.querySelectorAll('button')].find((candidate) => {
    const accessibleName = candidate.getAttribute('aria-label');
    return accessibleName ? accessibleName === name : candidate.textContent?.trim().startsWith(name);
  });
  expect(button, `No button named ${name}`).toBeTruthy();
  await act(async () => void (button as HTMLButtonElement).click());
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
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 6,
    seenOnboarding: true,
    folders: [
      { id: 'research', name: 'Research', parentId: null, created: 1 },
      { id: 'interviews', name: 'Interviews', parentId: 'research', created: 2 },
    ],
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<StoreProvider><Drive /></StoreProvider>));
  await act(async () => void (await Promise.resolve()));
  await click('My drive');
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Drive folder deletion', () => {
  it('previews the nested organization loss and changes nothing until confirmation', async () => {
    await click('Delete the folder Research. Anything in it moves up a level.');

    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Delete this folder?');
    expect(dialog?.textContent).toContain('Research');
    expect(dialog?.textContent).toContain('1 folder inside it');
    expect(dialog?.textContent).toContain('2 files stay on this device and move up to the level above Research');
    expect(dialog?.textContent).toContain('Course folders, folders outside Research, file contents, course links and deadline links stay unchanged');
    expect(dialog?.textContent).toContain('This can’t be undone. Recreate the folder structure and move the files back manually.');
    expect(host.textContent).toContain('Research');

    await click('Cancel');
    expect(host.textContent).toContain('Research');
    await click('Research');
    expect(host.textContent).toContain('Interviews');
    expect(files.moveFile).not.toHaveBeenCalled();
    await click('Drive');

    await click('Delete the folder Research. Anything in it moves up a level.');
    await click('Delete folder');
    expect(files.moveFile).toHaveBeenNthCalledWith(1, 'brief', null);
    expect(files.moveFile).toHaveBeenNthCalledWith(2, 'notes', null);
    expect(host.textContent).not.toContain('Research');
    expect(host.textContent).not.toContain('Interviews');
  });

  it('keeps the hierarchy when a file cannot be moved safely', async () => {
    files.moveFile.mockRejectedValueOnce(new Error('storage refused'));

    await click('Delete the folder Research. Anything in it moves up a level.');
    await click('Delete folder');
    await act(async () => void (await Promise.resolve()));

    expect(host.textContent).toContain('The file “Brief.pdf” could not be saved. There may be no room left on this device.');
    expect(host.querySelector('button[aria-label="Delete the folder Research. Anything in it moves up a level."]')).toBeTruthy();
    expect(files.moveFile).toHaveBeenCalledTimes(1);
  });
});
