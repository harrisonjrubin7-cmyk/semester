/// <reference types="node" />
// The app's tsconfig deliberately exposes only vite/client, so the app source
// cannot reach for a node API by accident. This one test needs the filesystem
// — that is the whole point of it — so it asks for those types itself.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PREBUILT_DECKS,
  PREBUILT_DOCS,
  hasPrebuiltDeck,
  hasPrebuiltDocs,
} from './handout';

/**
 * This suite reads the real `public/` directory rather than a fixture.
 *
 * That is the entire point of it. The bug it exists to prevent was a list of
 * paths in the code drifting from the files actually on the server, which
 * nothing noticed because a missing file is a 404 in a new tab rather than an
 * error anybody sees. A test against a fixture would have drifted with it.
 */
// Vitest runs with the app directory as its root.
const publicDir = join(process.cwd(), 'public');

const idsIn = (folder: string, extension: string): string[] =>
  readdirSync(join(publicDir, folder))
    .filter((name) => name.endsWith(extension))
    .map((name) => name.slice(0, -extension.length))
    .sort();

describe('the prebuilt file lists', () => {
  it('names exactly the decks that are on disk', () => {
    expect([...PREBUILT_DECKS].sort()).toEqual(idsIn('decks', '.pptx'));
  });

  it('names exactly the courses whose handouts are on disk', () => {
    // A course needs both to be listed — a PDF with no .docx beside it would
    // still leave one dead button.
    const pdfs = idsIn('handouts', '.pdf');
    const docs = idsIn('handouts', '.docx');
    expect(pdfs).toEqual(docs);
    expect([...PREBUILT_DOCS].sort()).toEqual(pdfs);
  });

  it('says no for a course somebody imported', () => {
    expect(hasPrebuiltDocs('psci-1104-abc123')).toBe(false);
    expect(hasPrebuiltDeck('psci-1104-abc123')).toBe(false);
  });

  it('says yes for the sample courses', () => {
    for (const id of PREBUILT_DOCS) expect(hasPrebuiltDocs(id)).toBe(true);
    for (const id of PREBUILT_DECKS) expect(hasPrebuiltDeck(id)).toBe(true);
  });
});
