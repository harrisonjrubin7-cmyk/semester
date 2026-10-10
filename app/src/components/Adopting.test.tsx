// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Adopting } from './Adopting';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function render(onChoose: (choice: 'merge' | 'cloud' | 'device', backup: string | null) => void | Promise<void>) {
  await act(async () => {
    root.render(
      <Adopting
        sides={{ cloud: 2, local: 1, cloudCourses: 1, localCourses: 1 }}
        say="This device and your account both have coursework."
        onChoose={onChoose}
      />,
    );
  });
}

const action = () => [...host.querySelectorAll('button')].find((button) => button.textContent === 'Keep both')!;

describe('Adopting', () => {
  it('locks every choice while the durable adoption is pending', async () => {
    let finish: () => void = () => {};
    const onChoose = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    await render(onChoose);
    const submit = action();

    await act(async () => { submit.click(); });

    expect(onChoose).toHaveBeenCalledOnce();
    expect([...host.querySelectorAll('button')].every((button) => button.disabled)).toBe(true);
    expect(host.textContent).toContain('Saving…');
    submit.click();
    expect(onChoose).toHaveBeenCalledOnce();

    await act(async () => { finish(); });
  });

  it('keeps the question open and usable when the durable write fails', async () => {
    const onChoose = vi.fn().mockRejectedValue(new Error('disk refused'));
    await render(onChoose);

    await act(async () => { action().click(); });

    expect(host.querySelector('[role="alert"]')?.textContent).toContain('could not be saved');
    expect([...host.querySelectorAll('button')].every((button) => !button.disabled)).toBe(true);
    expect(host.textContent).toContain('Keep both');
  });
});
