import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// The typefaces both sheets below name, declared once and served from this
// origin rather than from Google — see `styles/typefaces.css` for why.
import './styles/typefaces.css';
import './styles/industry.css';
import './styles/app.css';
import App from './App';
import { askToPersist } from './lib/device';
import { StoreProvider } from './state/store';
import { AIProvider } from './ai/store';
import { completeAuth } from './lib/connect';
import { load as loadFromDb, prime as primeDb } from './state/persist';
import { primePersisted } from './state/shape';
import { warm } from './lib/warm';

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

    /*
     * Register it now if the page has already loaded, and on `load` if it has
     * not — in that order, because by the time this runs it usually has.
     *
     * This was `window.addEventListener('load', …)` alone, and it never
     * fired. Look where it sits: inside `.finally()` on a chain that awaits
     * `completeAuth()` and then an IndexedDB read. Both settle well after the
     * document has finished loading — measured at 127ms for `load` against a
     * listener attached later still — so the app was adding a listener for an
     * event that had already happened, and `register` was never called at
     * all.
     *
     * Nothing failed. There is no error for subscribing to a past event, the
     * app works perfectly with no worker, and every check passed: the file
     * was built, deployed and served at `/semester/sw.js` with the right
     * type, and nothing ever asked for it. What it cost was the promise made
     * on the front of the README — *Add to Home Screen … keeps working with
     * no signal* — plus the cached lessons and podcast editions, all of which
     * are the worker's doing. Found by driving the live build in a phone
     * browser and pulling the network out from under it.
     *
     * `once` so a `load` that does somehow arrive after an immediate
     * registration cannot register a second time.
     */
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      const register = () => {
        const base = import.meta.env.BASE_URL || '/';
        void navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
        // The worker did not exist while this page's own bundles were being
        // fetched, so none of them passed through it and none was kept. Tell
        // it what was used, or the first visit offline is a blank page. See
        // `lib/warm.ts`.
        void warm(base);
      };
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register, { once: true });
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
