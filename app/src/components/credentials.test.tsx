// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('../lib/cloud', () => ({
  PROVIDER_LABEL: { google: 'Google', azure: 'Microsoft', apple: 'Apple' },
  PROVIDERS_SAID: 'Google, Microsoft or Apple',
  signUp: (email: string, password: string) => signUp(email, password),
  signIn: (email: string, password: string) => signIn(email, password),
  sendReset: (email: string) => sendReset(email),
  signInWith: (provider: string) => signInWith(provider),
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
  signUp.mockImplementation(async () => ({ said: 'Account made.', signedIn: true }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
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
