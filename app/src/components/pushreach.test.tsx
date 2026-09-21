// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { PushSwitch } from './PushSwitch';

/**
 * The iPhone that was told nothing.
 *
 * `PushSwitch` opened with `if (!canPush()) return null`, which is correct
 * arithmetic and the wrong answer on one platform. Safari has delivered web
 * push since iOS 16.4 and delivers it only to a page the student has added to
 * their home screen; a page in a Safari tab has no `PushManager`, so
 * `canPush()` was false, so the row was not drawn, so every iPhone opening
 * the alerts screen found the feature simply absent. Safari offers no install
 * prompt of its own — there is no `beforeinstallprompt` on iOS — so nothing
 * anywhere was ever going to tell them.
 *
 * That is the failure this app can least afford to have. The pitch is a
 * planner that actually reminds you, and Pulse — the companion app for
 * Brightspace, which is this university's own LMS — is reviewed almost
 * entirely on its notifications not arriving.
 *
 * ## Mounted, because the source reads fine either way
 *
 * `return null` on a false condition is what a correct guard looks like, and
 * the fix is a different branch of the same condition. Neither a grep nor a
 * reading distinguishes them. So three browsers are put in front of the
 * component and each is asked what it drew.
 *
 * The two that cannot push are each other's control — an iPhone must get the
 * gesture and a desktop must not, and a component that printed the home-screen
 * directions unconditionally would satisfy the first test and fail the second.
 * The third, where push works, is the control for both: it has to still draw
 * the switch, or "the row is there now" would be true of a component that had
 * stopped working.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

let host: HTMLDivElement;
let root: Root;

const ua = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');

function pretend(agent: string): void {
  Object.defineProperty(Navigator.prototype, 'userAgent', {
    configurable: true,
    get: () => agent,
  });
}

/** Give this browser everything `canPush` looks for, or take it away again. */
function pushable(yes: boolean): void {
  const g = globalThis as Record<string, unknown>;
  if (yes) {
    g.PushManager = class {};
    g.Notification = class {
      static permission = 'default';
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({}) },
    });
  } else {
    delete g.PushManager;
    delete g.Notification;
    // `'serviceWorker' in navigator` has to come back false, and a defined
    // property is still `in` however undefined its value.
    Reflect.deleteProperty(navigator, 'serviceWorker');
  }
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  host = document.createElement('div');
  document.body.append(host);
  await act(async () => {
    root = createRoot(host);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  pushable(false);
  if (ua) Object.defineProperty(Navigator.prototype, 'userAgent', ua);
  localStorage.clear();
});

async function draw(): Promise<void> {
  await act(async () => {
    root.render(
      <StoreProvider>
        <PushSwitch />
      </StoreProvider>,
    );
  });
}

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');

describe('an iPhone with the app in a Safari tab', () => {
  beforeEach(async () => {
    pushable(false);
    pretend(IPHONE);
    await draw();
  });

  it('does not draw nothing', () => {
    expect(text().trim()).not.toBe('');
  });

  it('says reminders cannot reach it yet, and exactly what to do', () => {
    expect(text()).toContain('home screen');
    expect(text()).toContain('Add to Home Screen');
    expect(text()).toContain('Share');
  });

  it('does not send anybody to an app store, because there is no app', () => {
    // "nothing is downloaded" is in the copy on purpose and is the opposite
    // claim, so this keys on being *sent* somewhere rather than on the word.
    expect(text()).not.toMatch(/App Store|Play Store/i);
    expect(text()).not.toMatch(/\b(install|download) (the |our )?app\b/i);
    expect(text()).toContain('nothing is downloaded');
  });
});

describe('a desktop browser that will not do push', () => {
  beforeEach(async () => {
    pushable(false);
    pretend('Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/121.0');
    await draw();
  });

  it('is the control: it must not be given iPhone directions', () => {
    expect(text()).not.toContain('Add to Home Screen');
  });

  it('still says something rather than leaving a hole', () => {
    // The old behaviour on every platform, and the thing that made the iPhone
    // case invisible: a row that is absent explains nothing to anybody.
    expect(text()).toContain('while it is open');
  });
});

describe('a browser that can push', () => {
  beforeEach(async () => {
    pushable(true);
    pretend('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120.0.0.0 Mobile Safari/537.36');
    await draw();
  });

  it('draws the switch, which is the control for both cases above', () => {
    expect(text()).toContain('Send reminders to this device');
    expect(text()).not.toContain('Add to Home Screen');
  });
});
