// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Capture } from './Capture';
import type { ShotFile } from '../lib/shots';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const shot = (name: string, preview: string, data: string): ShotFile => ({
  name,
  preview,
  kb: 1,
  shot: { mediaType: 'image/jpeg', data },
});

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('Capture photo removal', () => {
  it('distinguishes duplicate filenames and keeps retained thumbnail URLs alive', () => {
    const first = shot('board.jpg', 'blob:first', 'first');
    const second = shot('board.jpg', 'blob:second', 'second');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    let shots = [first, second];

    const render = () => {
      root.render(
        <Capture
          shots={shots}
          onChange={(next) => {
            shots = next;
            render();
          }}
        />,
      );
    };

    act(render);

    const removals = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remove photo "]')];
    expect(removals).toHaveLength(2);
    expect(removals[0].ariaLabel).toBe('Remove photo 1 of 2, board.jpg: about 1 KB');
    expect(removals[1].ariaLabel).toBe('Remove photo 2 of 2, board.jpg: about 1 KB');

    act(() => removals[1].click());

    expect(shots).toEqual([first]);
    expect(revoke).toHaveBeenCalledWith('blob:second');
    expect(revoke).not.toHaveBeenCalledWith('blob:first');
  });

  it('releases every remaining blob thumbnail when the picker unmounts', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    act(() => root.render(<Capture shots={[shot('notes.jpg', 'blob:notes', 'notes')]} onChange={vi.fn()} />));

    act(() => root.unmount());

    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:notes');
  });
});
