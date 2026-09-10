import { describe, expect, it } from 'vitest';
import { reducer } from '../reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type Action, type State } from '../shape';
import { fromRows } from '../../lib/sheet';

/**
 * The three lists of things you make, and the two rules that matter.
 *
 * **Making does not always take you there.** `newDocument` opens the editor and
 * `makeDocument` does not, because the second is what a tool proposal
 * dispatches — and being thrown out of a half-read answer into an editor is a
 * loss the assistant should not be able to cause. The split is the same one
 * `notes.ts` draws, and the way it breaks is invisible: the assistant's write
 * lands, the screen changes under the reader, and nothing looks wrong.
 *
 * **Deleting the open one closes the editor.** A `documentId` pointing at a
 * document that has gone renders as an empty editor with a title field bound
 * to nothing — which is the shape of bug `screens/deadends.test.tsx` exists
 * for, arrived at from the other direction.
 */
const start = (): State => ({ ...DEFAULT_PERSISTED, ...initialEphemeral(new Date(2026, 8, 15)) });

const run = (state: State, ...actions: Action[]): State =>
  actions.reduce((s, a) => reducer(s, a), state);

describe('documents', () => {
  it('opens the editor on a new one', () => {
    const after = run(start(), { type: 'newDocument', courseId: null });
    expect(after.documents).toHaveLength(1);
    expect(after.screen).toBe('write');
    expect(after.documentId).toBe(after.documents[0].id);
  });

  it('does not move you when the assistant makes one', () => {
    const before = start();
    const after = run(before, {
      type: 'makeDocument',
      doc: {
        title: 'Memo',
        subtitle: '',
        courseId: null,
        blocks: [{ kind: 'text', text: 'Prose.' }],
      },
    });
    expect(after.documents).toHaveLength(1);
    expect(after.screen).toBe(before.screen);
    expect(after.documentId).toBeNull();
  });

  it('mints the id and the times rather than taking them from the caller', () => {
    const after = run(start(), {
      type: 'makeDocument',
      doc: { title: 'Memo', subtitle: '', courseId: null, blocks: [] },
    });
    const [doc] = after.documents;
    expect(doc.id).toBeTruthy();
    expect(doc.created).toBeGreaterThan(0);
    expect(doc.updated).toBeGreaterThan(0);
  });

  it('stamps `updated` on an edit, whatever the patch says', () => {
    const made = run(start(), {
      type: 'makeDocument',
      doc: { title: 'Memo', subtitle: '', courseId: null, blocks: [] },
    });
    const id = made.documents[0].id;
    const older = { ...made, documents: [{ ...made.documents[0], updated: 0 }] };
    const after = run(older, { type: 'updateDocument', id, patch: { title: 'Better memo' } });
    expect(after.documents[0].title).toBe('Better memo');
    expect(after.documents[0].updated).toBeGreaterThan(0);
  });

  it('closes the editor when the open document is deleted', () => {
    const made = run(start(), { type: 'newDocument', courseId: null });
    const after = run(made, { type: 'deleteDocument', id: made.documentId! });
    expect(after.documents).toHaveLength(0);
    expect(after.documentId).toBeNull();
    expect(after.blockAt).toBeNull();
  });

  it('leaves the editor alone when a different one is deleted', () => {
    const first = run(start(), { type: 'newDocument', courseId: null });
    const second = run(first, { type: 'newDocument', courseId: null });
    const other = second.documents.find((d) => d.id !== second.documentId)!;
    const after = run(second, { type: 'deleteDocument', id: other.id });
    expect(after.documentId).toBe(second.documentId);
  });
});

describe('sheets', () => {
  it('opens the grid on a new one and not on one the assistant built', () => {
    const opened = run(start(), { type: 'newSheet', courseId: null });
    expect(opened.screen).toBe('sheet');
    expect(opened.sheetId).toBeTruthy();

    const quiet = run(start(), {
      type: 'makeSheet',
      sheet: fromRows('Marks', [['Piece', 'Score'], ['Midterm', '88']]),
    });
    expect(quiet.sheets).toHaveLength(1);
    expect(quiet.sheetId).toBeNull();
  });

  it('closes the grid when the open sheet is deleted', () => {
    const made = run(start(), { type: 'newSheet', courseId: null });
    const after = run(made, { type: 'deleteSheet', id: made.sheetId! });
    expect(after.sheetId).toBeNull();
  });
});

describe('equations', () => {
  it('keeps one, newest first', () => {
    const after = run(
      start(),
      { type: 'saveEquation', equation: { name: 'First', latex: 'a', note: '', courseId: null } },
      { type: 'saveEquation', equation: { name: 'Second', latex: 'b', note: '', courseId: null } },
    );
    expect(after.equations.map((e) => e.name)).toEqual(['Second', 'First']);
  });

  it('gives an unnamed one a name rather than an empty row', () => {
    const after = run(start(), {
      type: 'saveEquation',
      equation: { name: '   ', latex: 'x^2', note: '', courseId: null },
    });
    expect(after.equations[0].name).toBe('Untitled equation');
  });

  it('removes the one asked for and nothing else', () => {
    const two = run(
      start(),
      { type: 'saveEquation', equation: { name: 'First', latex: 'a', note: '', courseId: null } },
      { type: 'saveEquation', equation: { name: 'Second', latex: 'b', note: '', courseId: null } },
    );
    const after = run(two, { type: 'deleteEquation', id: two.equations[0].id });
    expect(after.equations.map((e) => e.name)).toEqual(['First']);
  });
});
