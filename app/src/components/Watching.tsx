/**
 * Noticing when something goes wrong, so it can be described later.
 *
 * Mounted once, draws nothing. It listens for the two things a browser tells
 * you about — an uncaught error and a rejected promise nobody caught — and
 * writes them to a ring buffer on this device. Nothing is sent anywhere; see
 * `lib/diagnose.ts` for what is recorded and what is deliberately not.
 *
 * ## Why not a reporting service
 *
 * Because the moment one is added, this app is shipping somebody's error
 * messages to a third party they were never asked about, and error messages
 * carry the text they failed on. A local log and a button they press is slower
 * and is the version a person can consent to.
 *
 * ## It must not become the bug
 *
 * A logger that throws inside an error handler turns one visible problem into
 * two invisible ones. Every write is wrapped, a full storage is a reason to
 * stop rather than to retry, and nothing here ever re-throws.
 */

import { useEffect } from 'react';
import { useStore } from '../state/store';
import { LOG_KEY, add, entry, read } from '../lib/diagnose';

export function Watching() {
  const { state } = useStore();

  useEffect(() => {
    const write = (kind: 'error' | 'note', message: string, stack?: string) => {
      try {
        const log = read(localStorage.getItem(LOG_KEY));
        // The screen is read at write time rather than closed over, so an
        // error five screens later is not filed against this one.
        const where = document.body.dataset.screen ?? '';
        localStorage.setItem(LOG_KEY, JSON.stringify(add(log, entry(kind, message, where, stack))));
      } catch {
        // Storage full, or disabled. A logger that throws inside an error
        // handler turns one visible problem into two invisible ones.
      }
    };

    const onError = (e: ErrorEvent) => {
      write('error', e.message || 'Something threw with no message.', e.error?.stack);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r: unknown = e.reason;
      write(
        'error',
        r instanceof Error ? r.message : `A promise was rejected: ${String(r)}`,
        r instanceof Error ? r.stack : undefined,
      );
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  // Where they are, for the handlers above to read without re-subscribing on
  // every navigation.
  useEffect(() => {
    document.body.dataset.screen = state.screen;
  }, [state.screen]);

  return null;
}
