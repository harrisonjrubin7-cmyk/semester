/**
 * The things you make in the app: documents, sheets and equations.
 *
 * Three lists, one slice, because they are one idea — work with no copy
 * anywhere else — and because the rules that matter are the same for all
 * three: an id is minted here rather than by the caller, `updated` is stamped
 * here rather than trusted from the screen, and deleting the open one closes
 * the editor rather than leaving it pointing at a thing that is gone.
 *
 * ## Two ways in, on purpose
 *
 * `newDocument` and `newSheet` open the editor on what they make. `makeDocument`
 * and `makeSheet` do not: those are what a tool proposal dispatches, and being
 * thrown out of a half-read answer into an editor is a loss the assistant
 * should not be able to cause. It is the same split `notes.ts` draws between
 * `newNote` and `keepNote`, for the same reason.
 *
 * Returns null for an action that is not this slice's, so `reducer` can try
 * the next one. See `state/reducer.ts`.
 */

import { newId } from '../../lib/idb';
import { blankDoc, type Doc } from '../../lib/document';
import { blankSheet, type Sheet } from '../../lib/sheet';
import type { SavedEquation } from '../../lib/maths';
import type { Action, State } from '../shape';
import { push } from './navigate';

/** How many of each is kept. Generous, and there so nothing grows without a bound. */
const LIMIT = 200;

export function made(state: State, action: Action): State | null {
  switch (action.type) {
    case 'newDocument': {
      const doc: Doc = { ...blankDoc('', action.courseId), id: newId() };
      return push(
        { ...state, documents: [doc, ...state.documents], documentId: doc.id, blockAt: 0 },
        'write',
      );
    }

    case 'makeDocument': {
      const now = Date.now();
      const doc: Doc = { ...action.doc, id: newId(), created: now, updated: now };
      return { ...state, documents: [doc, ...state.documents].slice(0, LIMIT) };
    }

    case 'openDocument':
      return push({ ...state, documentId: action.id, blockAt: null }, 'write');

    case 'closeDocument':
      return { ...state, documentId: null, blockAt: null };

    case 'updateDocument':
      return {
        ...state,
        documents: state.documents.map((d) =>
          d.id === action.id ? { ...d, ...action.patch, updated: Date.now() } : d,
        ),
      };

    case 'deleteDocument':
      return {
        ...state,
        documents: state.documents.filter((d) => d.id !== action.id),
        documentId: state.documentId === action.id ? null : state.documentId,
        blockAt: state.documentId === action.id ? null : state.blockAt,
      };

    case 'editBlock':
      return { ...state, blockAt: action.at };

    case 'newSheet': {
      const sheet: Sheet = { ...blankSheet('', action.courseId), id: newId() };
      return push({ ...state, sheets: [sheet, ...state.sheets], sheetId: sheet.id }, 'sheet');
    }

    case 'makeSheet': {
      const now = Date.now();
      const sheet: Sheet = { ...action.sheet, id: newId(), created: now, updated: now };
      return { ...state, sheets: [sheet, ...state.sheets].slice(0, LIMIT) };
    }

    case 'openSheet':
      return push({ ...state, sheetId: action.id }, 'sheet');

    case 'closeSheet':
      return { ...state, sheetId: null };

    case 'updateSheet':
      return {
        ...state,
        sheets: state.sheets.map((s) =>
          s.id === action.id ? { ...s, ...action.patch, updated: Date.now() } : s,
        ),
      };

    case 'deleteSheet':
      return {
        ...state,
        sheets: state.sheets.filter((s) => s.id !== action.id),
        sheetId: state.sheetId === action.id ? null : state.sheetId,
      };

    case 'saveEquation': {
      const equation: SavedEquation = {
        ...action.equation,
        name: action.equation.name.trim() || 'Untitled equation',
        id: newId(),
        created: Date.now(),
      };
      return { ...state, equations: [equation, ...state.equations].slice(0, LIMIT) };
    }

    case 'deleteEquation':
      return { ...state, equations: state.equations.filter((e) => e.id !== action.id) };

    default:
      return null;
  }
}
