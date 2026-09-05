import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DRAFTS_KEY,
  LEAVING,
  SETTLE_MS,
  draftKey,
  readDrafts,
  restoredLine,
  withDraft,
  withoutDraft,
  type Drafts,
} from './draft';

/**
 * A long field that is still there when you come back.
 *
 * A drop-in for `useState('')` on any field somebody types paragraphs into.
 * The rules it follows, and why each one, are in `lib/draft.ts`; this is the
 * React half, kept separate so the rules can be tested without a browser.
 *
 *     const essay = useDraft('essay', 'draft');
 *     <textarea value={essay.value} onChange={(e) => essay.set(e.target.value)} />
 *     // when the work has been filed:
 *     essay.done();
 */
export interface DraftField {
  value: string;
  set: (text: string) => void;
  /** Finished with — drop the saved copy. Call after filing or sending. */
  done: () => void;
  /** A line to show once, when something was put back. Empty otherwise. */
  said: string;
  /** Stop showing that line. */
  hush: () => void;
}

function load(): Drafts {
  try {
    return readDrafts(localStorage.getItem(DRAFTS_KEY));
  } catch {
    // A private window with storage off is a device with no drafts, not an
    // error worth surfacing on a screen somebody came to write on.
    return {};
  }
}

function store(drafts: Drafts): void {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // The budget is the account's first. A draft that will not fit is lost
    // quietly rather than taking the save that matters down with it.
  }
}

export function useDraft(screen: string, field: string, about = ''): DraftField {
  const key = draftKey(screen, field, about);

  // Read once, lazily, so the field is filled before anything is painted
  // rather than flickering from empty to full.
  const [first] = useState(() => {
    const saved = load()[key];
    return saved
      ? { text: saved.text, said: restoredLine(saved.at, new Date()) }
      : { text: '', said: '' };
  });

  const [value, setValue] = useState(first.text);
  const [said, setSaid] = useState(first.said);

  /**
   * The text typed since the last write, or null when there is nothing owing.
   *
   * One ref rather than a flag beside a copy of the value: those two can
   * disagree, and the whole job here is to know exactly what has not been
   * saved yet. Written only from an event handler or an effect.
   */
  const owing = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const write = useCallback(
    (text: string) => {
      store(withDraft(load(), key, text, Date.now()));
      owing.current = null;
    },
    [key],
  );

  const set = useCallback(
    (text: string) => {
      setValue(text);
      // The line explained where the text came from. Once it has been typed
      // over, it is describing something that is no longer true.
      setSaid('');
      owing.current = text;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => write(text), SETTLE_MS);
    },
    [write],
  );

  const done = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    owing.current = null;
    setValue('');
    setSaid('');
    store(withoutDraft(load(), key));
  }, [key]);

  /*
   * Every way out of this field, each closing a different gap.
   *
   * Leaving the screen inside the app would otherwise drop the pending write
   * along with the component. Backgrounding on a phone fires
   * `visibilitychange` and may never fire anything else before the page is
   * discarded — it is the one that actually catches somebody switching apps
   * mid-sentence. And `beforeunload` is the last resort for the few hundred
   * milliseconds between a keystroke and the write it triggers.
   *
   * The prompt is asked for only when something is genuinely owing. A reload
   * prompt that fires with nothing to lose is how people learn to click
   * straight through them, and then it is not there on the day it matters.
   * Browsers ignore the message and show their own; `LEAVING` exists so there
   * is one place saying what the guard is for.
   *
   * `write` changes identity when the key does, so switching course flushes
   * to the key the text was typed under rather than to the new one.
   */
  useEffect(() => {
    const flush = () => {
      if (owing.current !== null) write(owing.current);
    };
    const leaving = (e: BeforeUnloadEvent) => {
      if (owing.current === null) return;
      flush();
      e.preventDefault();
      e.returnValue = LEAVING;
    };
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', leaving);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('beforeunload', leaving);
      document.removeEventListener('visibilitychange', hidden);
      if (timer.current) clearTimeout(timer.current);
      flush();
    };
  }, [write]);

  return { value, set, done, said, hush: () => setSaid('') };
}
