/**
 * Practice papers sat, and the sources you have collected.
 *
 * Both are things the app refuses to invent: a sitting is a paper you
 * actually took, and a source is a citation you actually have. The room draft
 * and the exam preset are the short-lived state that carries you between two
 * screens without a query string.
 *
 * Returns null for an action that is not this slice's, so `reducer` can try
 * the next one. See `state/reducer.ts`.
 */

import { newId } from '../../lib/files';
import type { Action, State } from '../shape';
import { push } from './navigate';

export function papers(state: State, action: Action): State | null {
  switch (action.type) {
    case 'keepSitting':
      return {
        ...state,
        sittings: [{ ...action.sitting, id: newId() }, ...state.sittings].slice(0, 40),
      };

    case 'dropSitting':
      return { ...state, sittings: state.sittings.filter((s) => s.id !== action.id) };

    case 'addSource':
      return {
        ...state,
        sources: [{ ...action.source, id: newId(), created: Date.now() }, ...state.sources],
      };

    case 'patchSource':
      return {
        ...state,
        sources: state.sources.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      };

    case 'dropSource':
      return { ...state, sources: state.sources.filter((s) => s.id !== action.id) };

    case 'sitPaper':
      return push(
        { ...state, examPreset: { minutes: action.minutes, formatId: action.formatId, code: action.code } },
        'exam',
      );

    // Read once and dropped, so coming back to Exam later opens on your own
    // last choice rather than on whatever the quiz asked for an hour ago.
    case 'clearPaperPreset':
      return { ...state, examPreset: null };

    case 'writeRoomDraft':
      return { ...state, roomDraft: action.text };

    case 'clearRoomDraft':
      return { ...state, roomDraft: '' };

    default:
      return null;
  }
}
