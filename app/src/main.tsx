import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/industry.css';
import './styles/app.css';
import App from './App';
import { StoreProvider } from './state/store';
import { completeAuth } from './lib/connect';

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
  .finally(() => {
    // The worker is what makes this installable as its own window, and what
    // keeps a lesson playable with no signal. Only in a build: in dev it would
    // serve yesterday's bundle back to you.
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        void navigator.serviceWorker.register('/sw.js');
      });
    }

    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <StoreProvider>
          <App />
        </StoreProvider>
      </StrictMode>,
    );
  });
