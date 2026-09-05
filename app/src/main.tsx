import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/industry.css';
import './styles/app.css';
import App from './App';
import { askToPersist } from './lib/device';
import { StoreProvider } from './state/store';
import { AIProvider } from './ai/store';
import { completeAuth } from './lib/connect';
import { load as loadFromDb, prime as primeDb } from './state/persist';
import { primePersisted } from './state/shape';

/**
 * A sign-in comes back as a redirect to this same page. Redeem the code before
 * anything renders, so the app never mounts with a spent code in the address
 * bar, and leave a line behind for the Connect screen to show.
 */
completeAuth()
  .then((result) => {
    if (!result) return;
    sessionStorage.setItem(
      'semester.oauth.note',
      result.error
        ? `That sign-in did not finish: ${result.error}`
        : 'Signed in. Pull the calendar to bring the dates across.',
    );
  })
  .catch(() => {
    sessionStorage.setItem('semester.oauth.note', 'That sign-in did not finish.');
  })
  // The account comes out of IndexedDB now, and IndexedDB cannot answer
  // synchronously — so it is read here, before anything mounts, and left where
  // the reducer's initialiser will find it already waiting. Nothing renders
  // against a half-loaded store, which is what would send somebody who has
  // used this for a month back through onboarding.
  //
  // A device that will not open a database gets null, and the app falls
  // straight back to the localStorage path it has always had. See
  // `state/persist/`.
  .then(() => loadFromDb().catch(() => null))
  .then((state) => {
    primePersisted(state);
    // The first diff has to be against what was just read, or the first write
    // would rewrite every record in the account.
    if (state) primeDb(state);
  })
  .catch(() => primePersisted(null))
  .finally(() => {
    // The worker is what makes this installable as its own window, and what
    // keeps a lesson playable with no signal. Only in a build: in dev it would
    // serve yesterday's bundle back to you.
    // Ask the browser not to evict the semester. A request, not a setting:
    // an installed app is usually granted it silently, a tab on engagement or
    // not at all. Either answer is fine — not asking is what guarantees the
    // eviction is allowed. See `lib/device.ts`.
    void askToPersist();

    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        const base = import.meta.env.BASE_URL || '/';
        void navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
      });
    }

    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <StoreProvider>
          {/* The assistant's own state sits above the router, so it is one
              thing across all fifty screens rather than a thing each screen
              mounts. See `ai/store.tsx`. */}
          <AIProvider>
            <App />
          </AIProvider>
        </StoreProvider>
      </StrictMode>,
    );
  });
