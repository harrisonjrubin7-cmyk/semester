// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { canSend, governs, helpState } from './converse';
import { Composer } from './Composer';
import { HowItHelps } from './HelpNotice';
import { MODES } from '../lib/socratic';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/*
 * The Ask tab offered four live suggestions and a live composer under five
 * disabled mode pills and "No help mode is available for this course." The
 * cause was a build with Semester Intelligence on and no university gateway
 * behind it: the flag alone decided the gateway governed, the policy request
 * to a gateway that did not exist failed, and the failure was stored as "no
 * modes". These hold the three parts of the fix.
 */
describe('who governs the modes', () => {
  it('is the local assistant when the flag is on but no gateway is configured', () => {
    expect(governs('preview', false)).toBe(false);
    expect(governs('production', false)).toBe(false);
  });
  it('is the gateway only when the flag is on and a gateway is configured', () => {
    expect(governs('preview', true)).toBe(true);
    expect(governs('off', true)).toBe(false);
  });
});

describe('helpState', () => {
  const local = { governed: false, lookup: 'checking' as const };

  it('is ready on the local path with every mode, whatever the lookup says', () => {
    expect(helpState({ ...local, allowed: [...MODES] })).toEqual({ kind: 'ready' });
  });

  it('tells a failed policy read apart from a school that allows nothing', () => {
    const governed = { governed: true, allowed: [] };
    expect(helpState({ ...governed, lookup: 'unreachable' }).kind).toBe('unreachable');
    expect(helpState({ ...governed, lookup: 'ready' }).kind).toBe('school-off');
    expect(helpState({ ...governed, lookup: 'checking' }).kind).toBe('checking');
  });

  it('keeps planning help for a course whose policy bans AI help', () => {
    const help = helpState({ ...local, allowed: [], course: 'ECON 1010', instead: ['Office hours'] });
    expect(help).toEqual({ kind: 'course-off', course: 'ECON 1010', instead: ['Office hours'] });
    expect(canSend(help)).toBe(true);
  });

  it('only lets a message go when something can answer it', () => {
    expect(canSend({ kind: 'ready' })).toBe(true);
    expect(canSend({ kind: 'unreachable' })).toBe(false);
    expect(canSend({ kind: 'school-off' })).toBe(false);
    expect(canSend({ kind: 'checking' })).toBe(false);
  });
});

describe('the strip above the composer', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeAll(async () => {
    window.matchMedia = (() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    await loadSeed();
  });
  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    act(() => {
      root = createRoot(host);
    });
  });
  /* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const draw = (help: Parameters<typeof HowItHelps>[0]['help'], onRetry = vi.fn()) =>
    act(() =>
      root.render(
        <StoreProvider>
          <HowItHelps
            help={help}
            requested="explain"
            allowed={help.kind === 'ready' ? [...MODES] : []}
            reason=""
            onChange={() => {}}
            onRetry={onRetry}
            noticeId="why"
            noticeVariant="full"
          />
          <Composer
            value="What is due?"
            onChange={() => {}}
            onSend={() => {}}
            onStop={() => {}}
            busy={false}
            placeholder=""
            blockedBy={canSend(help) ? undefined : 'why'}
          />
        </StoreProvider>,
      ),
    );

  it('never draws five disabled modes with a sentence under them', () => {
    draw({ kind: 'unreachable' });
    expect(host.querySelectorAll('input[type="radio"]').length).toBe(0);
    expect(host.textContent).not.toContain('No help mode');
    expect(host.querySelector('h2')?.textContent).toMatch(/couldn’t reach/);
  });

  it('disables the composer and names the reason as its description', () => {
    draw({ kind: 'school-off' });
    const field = host.querySelector<HTMLTextAreaElement>('textarea')!;
    expect(field.disabled).toBe(true);
    expect(field.getAttribute('aria-describedby')).toBe('why');
    expect(host.querySelector('#why')?.textContent).toMatch(/has not turned on/);
    const send = host.querySelector<HTMLButtonElement>('button[aria-label="Send message"]')!;
    expect(send.disabled).toBe(true);
  });

  it('offers a retry that asks the school again', () => {
    const retry = vi.fn();
    draw({ kind: 'unreachable' }, retry);
    const again = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Try again');
    act(() => again?.click());
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('draws the picker, and a live composer, when help is ready', () => {
    draw({ kind: 'ready' });
    expect(host.querySelectorAll('input[type="radio"]:not(:disabled)').length).toBe(MODES.length + 4);
    expect(host.querySelector('textarea')?.disabled).toBe(false);
  });
});
