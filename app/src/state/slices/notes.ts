/**
 * Notes, and the files attached to them.
 *
 * `newNote` opens the editor and `keepNote` does not — the second is used
 * from screens where you are mid-task and being thrown into an editor would
 * lose your place. Files themselves live in IndexedDB; a note holds their ids.
 *
 * Returns null for an action that is not this slice's, so `reducer` can try
 * the next one. See `state/reducer.ts`.
 */

import { newId } from '../../lib/files';
import type { Note } from '../../lib/types';
import type { Action, State } from '../shape';
import { push } from './navigate';

export function notes(state: State, action: Action): State | null {
  switch (action.type) {
    case 'newNote': {
      const note: Note = {
        id: newId(),
        title: '',
        body: '',
        created: Date.now(),
        updated: Date.now(),
        courseId: action.courseId,
        fileIds: [],
      };
      return push({ ...state, notes: [note, ...state.notes], noteId: note.id }, 'note');
    }

    case 'keepNote': {
      // Unlike newNote this does not navigate: it is used from screens where
      // you are mid-task and being thrown into an editor would lose your place.
      const note: Note = {
        id: newId(),
        title: action.title.trim() || 'Untitled',
        body: action.body,
        created: Date.now(),
        updated: Date.now(),
        courseId: action.courseId,
        fileIds: [],
      };
      return { ...state, notes: [note, ...state.notes] };
    }

    case 'openNote':
      return push({ ...state, noteId: action.id }, 'note');

    case 'updateNote':
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.id ? { ...n, ...action.patch, updated: Date.now() } : n,
        ),
      };

    case 'attachFile':
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.noteId && !n.fileIds.includes(action.fileId)
            ? { ...n, fileIds: [...n.fileIds, action.fileId], updated: Date.now() }
            : n,
        ),
      };

    case 'detachFile':
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.noteId
            ? { ...n, fileIds: n.fileIds.filter((f) => f !== action.fileId), updated: Date.now() }
            : n,
        ),
      };

    case 'deleteNote':
      return {
        ...state,
        notes: state.notes.filter((n) => n.id !== action.id),
        noteId: state.noteId === action.id ? null : state.noteId,
      };

    default:
      return null;
  }
}
