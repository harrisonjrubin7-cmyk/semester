// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CourseCapture } from './CourseCapture';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const mount = (over: Partial<Parameters<typeof CourseCapture>[0]> = {}) => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <CourseCapture
        courseId="econ"
        policy={{ recording: 'permitted', modelProcessing: true }}
        onFiles={vi.fn()}
        {...over}
      />,
    ),
  );
};

const consent = () => {
  const box = host.querySelector('[aria-label="I have permission to capture and process this material"]') as HTMLInputElement;
  act(() => box.click());
};

describe('CourseCapture', () => {
  it('requires explicit consent and accepts audio, video, image and document files', async () => {
    const onFiles = vi.fn();
    mount({ onFiles });
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toContain('audio/*');
    expect(input.accept).toContain('video/*');
    expect(input.accept).toContain('image/*');
    expect(input.disabled).toBe(true);

    consent();
    const enabledInput = host.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['lecture'], 'lecture.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(enabledInput, 'files', { configurable: true, value: [file] });
    await act(async () => {
      enabledInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() => {
      expect(onFiles).toHaveBeenCalledWith([file]);
      expect(host.querySelector('[role="status"]')?.textContent).toContain('preserved locally');
    });
  });

  it('shows denied policy and removes a local original', async () => {
    mount({ policy: { recording: 'prohibited', modelProcessing: false } });
    expect(host.textContent).toContain('Recording is not permitted');
    consent();
    expect((host.querySelector('input[type="file"]') as HTMLInputElement).disabled).toBe(true);

    act(() => root.unmount());
    host.remove();
    mount();
    consent();
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['image'], 'problem.png', { type: 'image/png' })],
    });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() => expect(host.querySelector('[aria-label^="Remove capture 1 of 1, problem.png:"]')).toBeTruthy());
    const remove = host.querySelector('[aria-label^="Remove capture 1 of 1, problem.png:"]') as HTMLButtonElement;
    act(() => remove.click());
    expect(host.querySelector('[aria-label^="Remove capture "]')).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('was removed');
  });

  it('distinguishes duplicate filenames and removes only the selected persisted copy', async () => {
    const onFiles = vi.fn(async () => [{ id: 'stored-first' }, { id: 'stored-second' }]);
    const onRemovePersisted = vi.fn(async () => undefined);
    mount({ onFiles, onRemovePersisted });
    consent();
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    const first = new File(['first'], 'lecture.png', { type: 'image/png' });
    const second = new File(['other'], 'lecture.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { configurable: true, value: [first, second] });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await vi.waitFor(() => expect(onFiles).toHaveBeenCalledWith([first, second]));
    });

    const removals = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remove capture "]')];
    expect(removals).toHaveLength(2);
    expect(removals[0].ariaLabel).toMatch(/^Remove capture 1 of 2, lecture\.png: image\/png · 5 bytes · hash /);
    expect(removals[1].ariaLabel).toMatch(/^Remove capture 2 of 2, lecture\.png: image\/png · 5 bytes · hash /);
    expect(removals[0].ariaLabel).not.toBe(removals[1].ariaLabel);

    await act(async () => {
      removals[0].click();
      await Promise.resolve();
    });

    expect(onRemovePersisted).toHaveBeenCalledTimes(1);
    expect(onRemovePersisted).toHaveBeenCalledWith(['stored-first']);
    expect(host.querySelectorAll('.course-capture-original')).toHaveLength(1);
    expect(host.textContent).toContain('lecture.png');
  });

  it('keeps the represented original when persisted removal is refused', async () => {
    const onRemovePersisted = vi.fn(async () => { throw new Error('storage unavailable'); });
    const onFiles = vi.fn(async () => [{ id: 'stored-1' }]);
    mount({ onFiles, onRemovePersisted });
    consent();
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['notes'], 'notes.txt', { type: 'text/plain' })],
    });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() => expect(onFiles).toHaveBeenCalled());
    await vi.waitFor(() => expect(host.querySelector('[aria-label^="Remove capture 1 of 1, notes.txt:"]')).toBeTruthy());

    await act(async () => {
      (host.querySelector('[aria-label^="Remove capture 1 of 1, notes.txt:"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(onRemovePersisted).toHaveBeenCalledWith(['stored-1']);
    expect(host.querySelector('[aria-label^="Remove capture 1 of 1, notes.txt:"]')).toBeTruthy();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('remain available; try again');
  });

  it('withdrawal clears persisted originals and prevents in-flight work from repopulating', async () => {
    let finish!: (value: Array<{ id: string }>) => void;
    const onFiles = vi.fn(() => new Promise<Array<{ id: string }>>((resolve) => { finish = resolve; }));
    const onRemovePersisted = vi.fn();
    mount({ onFiles, onRemovePersisted });
    consent();
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['x'], 'lecture.mp3', { type: 'audio/mpeg' })] });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await vi.waitFor(() => expect(onFiles).toHaveBeenCalled()); });
    consent();
    await act(async () => { finish([{ id: 'stored-1' }]); await Promise.resolve(); });
    expect(host.querySelector('[aria-label="Remove lecture.mp3"]')).toBeNull();
    expect(onRemovePersisted).toHaveBeenCalledWith(['stored-1']);
  });
});
