// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';

/**
 * Registering, and never being asked to register twice.
 *
 * The account screen has offered a password form for as long as it has
 * existed, and it opened on **sign in** for everybody — including the person
 * opening the app for the first time, who has nothing to sign in with. The
 * way to an account was a text link under the button, on a screen reached
 * through Settings, which is not a way anybody found.
 *
 * So the first run asks now, and this is the rule it asks by: a device that
 * has never had an account is offered one, and from then on it is asked for
 * the address and the password and nothing else. Everything below is that
 * sentence, checked — including the two failure paths that decide whether
 * somebody ends up with two accounts or none.
 *
 * The store and the account service are both replaced. What is under test is
 * the reasoning between the two: which call a submission makes, what it
 * remembers afterwards, and when the first run is allowed to move on.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** What the device remembers, per test. See `state.registered`. */
let registered = false;
const dispatched: { type: string }[] = [];

vi.mock('../state/store', () => ({
  useStore: () => ({
    state: { registered },
    dispatch: (action: { type: string }) => dispatched.push(action),
  }),
}));

type Made = { said: string; signedIn: boolean };

const signUp = vi.fn<(email: string, password: string) => Promise<Made>>(async () => ({
  said: 'Account made.',
  signedIn: true,
}));
const signIn = vi.fn<(email: string, password: string) => Promise<void>>(async () => {});
const sendReset = vi.fn<(email: string) => Promise<string>>(async () => 'A reset link is on its way.');
const signInWith = vi.fn<(provider: string) => Promise<void>>(async () => {});
const signInWithSSO = vi.fn<
  (options: { domain: string; redirectTo: string }) => Promise<void>
>(async () => {});
const institutionSsoConfig = vi.fn(async () => null as {
  enabled: true;
  label: string;
  domain: string;
} | null);

/**
 * What the project says it has switched on, and when it says it.
 *
 * A promise rather than a value, because *when* the answer lands is half of
 * what the form does with it: until it has one it draws no provider buttons at
 * all, and a test that resolved before the first render could not tell that
 * apart from a project with none on. `answer` settles it by hand.
 */
let answer: (got: string[] | null) => void;
let asking: Promise<string[] | null>;
const providersOn = vi.fn<() => Promise<string[] | null>>(() => asking);

vi.mock('../lib/cloud', () => ({
  PROVIDER_LABEL: { google: 'Google', azure: 'Microsoft', apple: 'Apple' },
  // The real one — it is four lines and what it joins is the point.
  namesSaid: (names: string[]) =>
    names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`,
  providersOn: () => providersOn(),
  institutionSsoConfig: () => institutionSsoConfig(),
  appUrl: () => 'https://semester.example/',
  signUp: (email: string, password: string) => signUp(email, password),
  signIn: (email: string, password: string) => signIn(email, password),
  sendReset: (email: string) => sendReset(email),
  signInWith: (provider: string) => signInWith(provider),
  signInWithSSO: (options: { domain: string; redirectTo: string }) => signInWithSSO(options),
}));

const { Credentials } = await import('./Credentials');

let host: HTMLDivElement;
let root: Root;

function show(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

/**
 * Typing, the way the browser does it.
 *
 * A React input reads its value from state, so assigning `.value` and firing
 * `input` is not enough on its own — React's own value tracker sees no change
 * and swallows the event. Going through the prototype's setter is what makes
 * the tracker notice, and it is the shape every React testing library uses.
 */
function type(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const email = () => host.querySelector('#account-email') as HTMLInputElement;
const password = () => host.querySelector('#account-password') as HTMLInputElement;
const submit = () => host.querySelector('button[type=submit]') as HTMLButtonElement;
const link = (said: string) =>
  [...host.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === said);

/** The provider buttons, by their labels. Not the form's own two links. */
const providerButtons = () =>
  [...host.querySelectorAll('button[type=button]')]
    .map((b) => (b.textContent ?? '').trim())
    .filter((t) => ['Google', 'Microsoft', 'Apple'].includes(t));

/** Render, then let the project's answer land. */
async function showAnswered(node: ReactNode, got: string[] | null) {
  show(node);
  answer(got);
  await act(async () => {
    await asking;
  });
}

async function send() {
  await act(async () => {
    host
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

/** Fill both fields and submit, which is the whole of what this form asks. */
async function enter(address = 'you@vanderbilt.edu', secret = 'a-real-password') {
  type(email(), address);
  type(password(), secret);
  await send();
}

beforeEach(() => {
  registered = false;
  dispatched.length = 0;
  signUp.mockClear();
  signIn.mockClear();
  sendReset.mockClear();
  signInWith.mockClear();
  signInWithSSO.mockClear();
  institutionSsoConfig.mockReset();
  institutionSsoConfig.mockResolvedValue(null);
  providersOn.mockClear();
  signUp.mockImplementation(async () => ({ said: 'Account made.', signedIn: true }));
  asking = new Promise((resolve) => {
    answer = resolve;
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/*
 * Every root this file made, none of which was being taken down.
 *
 * The others in this class tore down in `beforeEach` and leaked only the last
 * one. This file had no teardown at all, so each test mounted a fresh root
 * over the top of a live one and left the lot standing.
 *
 * That matters here beyond the tidying. `signUp`, `signIn` and `sendReset`
 * are mocks this file counts calls on, and a form still mounted from an
 * earlier test is still subscribed and can still answer a promise — so a
 * stray call lands in the next test's tally, and the failure appears in a
 * test that did nothing wrong. Under `isolate: false` the last one outlives
 * the file, where React schedules work on it after the environment has gone:
 * the unhandled `ReferenceError: window is not defined` out of `react-dom`
 * that `screens/deadends.test.tsx` was fixed for, which lands on whichever
 * file happens to be running.
 *
 * Measured before the change: a live root with 2.4 KB of rendered tree still
 * attached at the end of this file.
 */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('the first time', () => {
  it('offers to make an account rather than asking to sign in', () => {
    show(<Credentials />);
    expect(submit().textContent).toBe('Create the account');
  });

  it('registers what was typed, and does not try to sign in with it', async () => {
    show(<Credentials />);
    await enter();
    expect(signUp).toHaveBeenCalledWith('you@vanderbilt.edu', 'a-real-password');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('remembers that this device now has an account', async () => {
    show(<Credentials />);
    await enter();
    expect(dispatched).toContainEqual({ type: 'registered' });
  });

  it('moves the first run on once there is a session', async () => {
    const done = vi.fn();
    show(<Credentials onDone={done} />);
    await enter();
    expect(done).toHaveBeenCalled();
  });

  /*
   * The path a project with email confirmation switched on actually takes.
   *
   * There is no session until a link in an inbox is clicked, so moving the
   * first run on would replace the only instruction that matters with the
   * next screen — and the person would come back to a form offering to make
   * the account they have already made.
   */
  it('waits, and switches to signing in, when a confirmation is needed', async () => {
    signUp.mockImplementation(async () => ({ said: 'Check your email.', signedIn: false }));
    const done = vi.fn();
    show(<Credentials onDone={done} />);
    await enter();
    expect(done).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Check your email.');
    expect(submit().textContent).toBe('Sign in');
    expect(dispatched).toContainEqual({ type: 'registered' });
  });
});

describe('every time after that', () => {
  it('asks only for the address and the password', () => {
    registered = true;
    show(<Credentials />);
    expect(submit().textContent).toBe('Sign in');
    expect(email()).toBeTruthy();
    expect(password()).toBeTruthy();
  });

  it('signs in with them rather than making a second account', async () => {
    registered = true;
    show(<Credentials />);
    await enter();
    expect(signIn).toHaveBeenCalledWith('you@vanderbilt.edu', 'a-real-password');
    expect(signUp).not.toHaveBeenCalled();
  });

  it('still offers a way to make one, for a device that is not the first', () => {
    registered = true;
    show(<Credentials />);
    expect(link('Make an account')).toBeTruthy();
  });
});

describe('what it refuses to send', () => {
  it('will not submit without an address', () => {
    show(<Credentials />);
    type(password(), 'a-real-password');
    expect(submit().disabled).toBe(true);
  });

  it('says the eight-character floor here rather than after a round trip', async () => {
    // Making one. Signing in with one is the case below.
    show(<Credentials />);
    type(email(), 'you@vanderbilt.edu');
    type(password(), 'short');
    expect(submit().disabled).toBe(true);
    await send();
    expect(signUp).not.toHaveBeenCalled();
  });

  /*
   * The floor is a rule about choosing a password, and it was applied to
   * typing one you already have.
   *
   * Nothing in this project sets the minimum an account was made under — the
   * reset link this very form sends leads to Supabase's own page, which sets a
   * password under the project's floor and not under this one. So the app can
   * hand somebody a password and then refuse it, and refuse it in the worst
   * way available: the sign-in placeholder is the word "Password", so there is
   * a dead button and nothing on screen that says why.
   */
  it('does not hold an existing password to the length a new one needs', async () => {
    registered = true;
    show(<Credentials />);
    type(email(), 'you@vanderbilt.edu');
    type(password(), 'sixchr');
    expect(submit().disabled).toBe(false);
    await send();
    expect(signIn).toHaveBeenCalledWith('you@vanderbilt.edu', 'sixchr');
  });

  it('still asks for something to send', () => {
    registered = true;
    show(<Credentials />);
    type(email(), 'you@vanderbilt.edu');
    expect(submit().disabled).toBe(true);
  });
});

describe('changing your mind', () => {
  /*
   * The two mode switches are not the same event.
   *
   * A registration that needs a confirmation switches to sign-in by itself and
   * keeps the sentence about the inbox up, because that is the instruction.
   * Pressing the link is somebody asking a different question, and the answer
   * to the last one has no business under it: "User already registered" sat
   * under a form now offering to sign in, where it reads as the answer to a
   * press that has not happened.
   */
  it('clears what the other mode said', async () => {
    signUp.mockImplementation(async () => {
      throw new Error('User already registered');
    });
    show(<Credentials />);
    await enter();
    expect(host.querySelector('[role=alert]')).toBeTruthy();
    act(() => link('I already have one')?.click());
    expect(submit().textContent).toBe('Sign in');
    expect(host.querySelector('[role=alert]')).toBeNull();
  });
});

describe('the reset link', () => {
  /*
   * It returned nothing, and the form only shows a sentence when there is one,
   * so a reset that worked looked exactly like a button that did not.
   */
  it('says that it went', async () => {
    registered = true;
    show(<Credentials />);
    type(email(), 'you@vanderbilt.edu');
    await act(async () => link('Send a reset link')?.click());
    expect(sendReset).toHaveBeenCalledWith('you@vanderbilt.edu');
    expect(host.querySelector('[role=status]')?.textContent).toContain('on its way');
  });
});

describe('the provider buttons', () => {
  /*
   * Every provider is a switch in the Supabase dashboard, and until now
   * nothing in the app could see it — so this form drew Google, Microsoft and
   * Apple whatever the project had on. On a project with none of them on, and
   * that is every project until somebody pastes a client id, all three were
   * doors that could not open: a press spent a round trip and came back with
   * "Unsupported provider: provider is not enabled", a sentence addressed to
   * whoever runs the deployment and shown to a student, after the press.
   *
   * That is the shape `c301c98` took off the import screen a few hours ago —
   * the gate belongs in the button's place, so the answer arrives before the
   * press rather than as an error card after it. This is the same fix on the
   * last screen that still had it.
   */
  it('draws only the ones the project has switched on', async () => {
    await showAnswered(<Credentials />, ['google']);
    expect(providerButtons()).toEqual(['Google']);
  });

  it('draws all of them when the project has all of them on', async () => {
    // The control. A form that had simply stopped drawing provider buttons
    // would pass the test above, and this is what refuses that.
    await showAnswered(<Credentials />, ['google', 'azure', 'apple']);
    expect(providerButtons()).toEqual(['Google', 'Microsoft', 'Apple']);
  });

  it('names in the sentence exactly the ones it drew', async () => {
    // The fault this form has now had twice: the paragraph offering three
    // providers under one button. It used to be generated from the record of
    // what the app knows, which is not the same list as what the project has.
    await showAnswered(<Credentials />, ['google', 'azure']);
    expect(host.textContent).toContain('Any Google or Microsoft account works');
    expect(host.textContent).not.toContain('Apple');
  });

  it('still signs in with the one that was pressed', async () => {
    await showAnswered(<Credentials />, ['azure']);
    await act(async () => link('Microsoft')?.click());
    expect(signInWith).toHaveBeenCalledWith('azure');
  });

  describe('when the project has none switched on', () => {
    it('draws no provider buttons at all', async () => {
      await showAnswered(<Credentials />, []);
      expect(providerButtons()).toEqual([]);
    });

    it('says which way in there is, rather than leaving three dead buttons', async () => {
      await showAnswered(<Credentials />, []);
      expect(host.textContent).toContain('no sign-in provider is switched on');
      // And the way in that does work is still right there.
      expect(submit()).toBeTruthy();
    });

    it('names the buttons it is not drawing from the record, not by hand', async () => {
      // The first draft of this sentence said "no Google or Microsoft button
      // to press" — two names written out, in the one change whose whole
      // subject is a paragraph naming a different set from the buttons.
      await showAnswered(<Credentials />, []);
      expect(host.textContent).toContain('no Google, Microsoft or Apple button to press');
    });
  });

  describe('when it could not ask', () => {
    /*
     * `null` and `[]` are the same shape of "no buttons" and opposite facts.
     * One is the project saying it has none on; the other is this device
     * failing to reach it. Reading the second as the first hides a working
     * sign-in from somebody whose network dropped for a moment, which is a
     * worse outcome than a button that errors — so an unanswered check falls
     * back to what this form did before it could ask.
     */
    it('offers all of them rather than none', async () => {
      await showAnswered(<Credentials />, null);
      expect(providerButtons()).toEqual(['Google', 'Microsoft', 'Apple']);
    });

    it('does not tell somebody the project has no providers', async () => {
      await showAnswered(<Credentials />, null);
      expect(host.textContent).not.toContain('no sign-in provider is switched on');
    });
  });

  describe('while it is still asking', () => {
    /*
     * A button on this screen means a door that opens, and that is only true
     * if none are drawn before the answer is in. The form above is complete
     * and works on its own for the few hundred milliseconds this takes.
     */
    it('draws no provider buttons yet, and does not guess at the sentence', () => {
      show(<Credentials />);
      expect(providerButtons()).toEqual([]);
      expect(host.textContent).not.toContain('no sign-in provider is switched on');
    });

    it('still lets somebody sign in with an address and a password', async () => {
      registered = true;
      show(<Credentials />);
      await enter();
      expect(signIn).toHaveBeenCalledWith('you@vanderbilt.edu', 'a-real-password');
    });
  });
});

describe('the institution-approved SSO button', () => {
  it('appears only after the gateway supplies an enabled Vanderbilt configuration', async () => {
    institutionSsoConfig.mockResolvedValue({
      enabled: true,
      label: 'Vanderbilt',
      domain: 'vanderbilt.edu',
    });
    await showAnswered(<Credentials />, []);
    await act(async () => {
      await institutionSsoConfig.mock.results[0]?.value;
    });
    expect(link('Continue with Vanderbilt')).toBeTruthy();
  });

  it('stays absent when no authorized institutional provider is available', async () => {
    await showAnswered(<Credentials />, []);
    await act(async () => {
      await institutionSsoConfig.mock.results[0]?.value;
    });
    expect(link('Continue with Vanderbilt')).toBeUndefined();
  });

  it('uses the exact approved domain and app callback', async () => {
    institutionSsoConfig.mockResolvedValue({
      enabled: true,
      label: 'Vanderbilt',
      domain: 'vanderbilt.edu',
    });
    await showAnswered(<Credentials />, []);
    await act(async () => {
      await institutionSsoConfig.mock.results[0]?.value;
      link('Continue with Vanderbilt')?.click();
    });
    expect(signInWithSSO).toHaveBeenCalledWith({
      domain: 'vanderbilt.edu',
      redirectTo: 'https://semester.example/',
    });
  });

  it('shows a readable recovery when institutional sign-in fails', async () => {
    institutionSsoConfig.mockResolvedValue({
      enabled: true,
      label: 'Vanderbilt',
      domain: 'vanderbilt.edu',
    });
    signInWithSSO.mockRejectedValueOnce(new Error('Vanderbilt sign-in is temporarily unavailable.'));
    await showAnswered(<Credentials />, []);
    await act(async () => {
      await institutionSsoConfig.mock.results[0]?.value;
      link('Continue with Vanderbilt')?.click();
    });
    expect(host.querySelector('[role=alert]')?.textContent).toContain(
      'Vanderbilt sign-in is temporarily unavailable.',
    );
  });
});

describe('when the service says no', () => {
  it('shows what it said, and does not claim an account was made', async () => {
    signUp.mockImplementation(async () => {
      throw new Error('User already registered');
    });
    const done = vi.fn();
    show(<Credentials onDone={done} />);
    await enter();
    expect(host.querySelector('[role=alert]')?.textContent).toContain('User already registered');
    expect(done).not.toHaveBeenCalled();
    expect(dispatched).not.toContainEqual({ type: 'registered' });
  });
});

/*
 * The tree, taken down after each test.
 *
 * `beforeEach` made a root and nothing ever unmounted it, so every test left
 * one mounted and the last one outlived the file. React's scheduler still has
 * work queued against it, the environment is torn down underneath, and the
 * callback then throws `ReferenceError: window is not defined` — reported
 * against whichever file was running, not this one.
 * `src/rootunmount.test.ts` is why this cannot quietly go away again.
 */
afterEach(() => {
  if (root) act(() => root.unmount());
  host?.remove();
});
