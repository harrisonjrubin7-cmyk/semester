// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JOURNEYS } from '../lib/journeys';
import { JourneyCards } from './JourneyCards';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('JourneyCards', () => {
  const hosts: HTMLDivElement[] = [];

  afterEach(() => {
    for (const host of hosts.splice(0)) host.remove();
  });

  it('renders six keyboard-native choices without adding a page landmark or heading', () => {
    const host = document.createElement('div');
    hosts.push(host);
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(<JourneyCards journeys={JOURNEYS} onOpen={vi.fn()} />));

    const cards = host.querySelectorAll('button[data-journey-id]');
    expect(cards).toHaveLength(6);
    expect([...cards].every((card) => card.getAttribute('type') === 'button')).toBe(true);
    expect(host.querySelector('main')).toBeNull();
    expect(host.querySelector('h1, h2')).toBeNull();

    act(() => root.unmount());
  });

  it('opens the registered starting screen for the chosen journey', () => {
    const host = document.createElement('div');
    hosts.push(host);
    document.body.append(host);
    const onOpen = vi.fn();
    const root = createRoot(host);
    act(() => root.render(<JourneyCards journeys={JOURNEYS} onOpen={onOpen} />));

    const card = host.querySelector('[data-journey-id="learn-practice"]') as HTMLButtonElement;
    card.focus();
    act(() => card.click());
    expect(document.activeElement).toBe(card);
    expect(onOpen).toHaveBeenCalledWith('study');

    act(() => root.unmount());
  });
});
