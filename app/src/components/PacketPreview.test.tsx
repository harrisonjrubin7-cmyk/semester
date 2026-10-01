// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { candidate, approve, gather, preview, type Candidate } from '../lib/semester-packets';
import { PacketPreview } from './PacketPreview';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date(2026, 9, 7, 10, 0).getTime();
const items = (): Candidate[] => [
  candidate('q1', 'Questions', 'Which section fits my week?'),
  candidate('q2', 'Questions', 'Can ENG 110 count as an elective?'),
  { ...candidate('n1', 'Private notes', 'I am nervous about this'), private: true },
];

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const render = (el: React.ReactElement) => act(async () => root.render(el));
const text = () => host.textContent ?? '';
const confirmButton = () => [...host.querySelectorAll('button')].find((b) => b.textContent === 'Confirm this packet') as HTMLButtonElement;
const click = (el: Element) => act(async () => void el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const tick = (label: string) =>
  [...host.querySelectorAll('label')].find((l) => l.textContent?.includes(label))!.querySelector('input') as HTMLInputElement;

describe('PacketPreview', () => {
  it('starts with nothing ticked, an empty preview and a confirm button that is off', () => {
    const html = renderToStaticMarkup(<PacketPreview id="p1" kind="advisor" candidates={items()} now={NOW} onRelease={() => {}} />);
    expect(html).not.toContain('checked');
    expect(html).toContain('Nothing is included until you tick it');
    expect(html).toContain('Link ends');
    expect(html).toContain('Your private notes are never included.');
    expect(html).not.toContain('I am nervous');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Confirm this packet/);
  });

  it('shows exactly the preview of the packet built from the ticks', async () => {
    await render(<PacketPreview id="p1" kind="advisor" candidates={items()} now={NOW} onRelease={() => {}} />);
    await click(tick('Which section fits my week?'));
    const expected = preview(gather({ id: 'p1', kind: 'advisor', candidates: approve(items(), ['q1']), now: NOW }));
    const rows = [...host.querySelectorAll('dl > div')].map((d) => [d.querySelector('dt')!.textContent, d.querySelector('dd')!.textContent]);
    expect(rows).toEqual(expected.map((l) => [l.label, l.value]));
    expect(text()).not.toContain('Can ENG 110 count as an elective?</dd>');
    expect(rows.flat()).not.toContain('Can ENG 110 count as an elective?');
  });

  it('releases only when the student presses confirm, and hands over the previewed payload', async () => {
    const onRelease = vi.fn();
    await render(<PacketPreview id="p1" kind="advisor" candidates={items()} now={NOW} onRelease={onRelease} />);
    await click(tick('Which section fits my week?'));
    expect(onRelease).not.toHaveBeenCalled();
    await click(confirmButton());
    expect(onRelease).toHaveBeenCalledTimes(1);
    const payload = onRelease.mock.calls[0][0];
    expect(payload.lines.map((l: { value: string }) => l.value)).toContain('Which section fits my week?');
    expect(JSON.stringify(payload)).not.toContain('nervous');
    expect(payload.expiresAt).toBeGreaterThan(NOW);
  });

  it('does not enable confirm for a packet with nothing approved, and unticking takes an item back out', async () => {
    const onRelease = vi.fn();
    await render(<PacketPreview id="p1" kind="advisor" candidates={items()} now={NOW} onRelease={onRelease} />);
    await click(tick('Which section fits my week?'));
    expect(confirmButton().disabled).toBe(false);
    await click(tick('Which section fits my week?'));
    expect(confirmButton().disabled).toBe(true);
    await click(confirmButton());
    expect(onRelease).not.toHaveBeenCalled();
  });
});
