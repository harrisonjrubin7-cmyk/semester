import { afterEach, describe, expect, it, vi } from 'vitest';
import { canScan, isbnLabel, readIsbn, scanFrame } from './barcode';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reading an ISBN', () => {
  it('takes a scanner’s bare digits', () => {
    expect(readIsbn('9780134078779')).toBe('9780134078779');
  });

  it('takes the hyphens a person types', () => {
    expect(readIsbn('978-0-13-407877-9')).toBe('9780134078779');
    expect(readIsbn(' 978 0134 078779 ')).toBe('9780134078779');
  });

  it('takes the older ten-digit form, X and all', () => {
    expect(readIsbn('0-306-40615-2')).toBe('0306406152');
    expect(readIsbn('097522980X')).toBe('097522980X');
  });

  it('refuses a barcode that is not a book', () => {
    // A tin of soup is an EAN-13 too. Storing it as an ISBN would put a
    // number next to a price that means nothing.
    expect(readIsbn('5000112637922')).toBe('');
    expect(readIsbn('12345')).toBe('');
    expect(readIsbn('')).toBe('');
  });

  it('reads as a label, or as nothing', () => {
    expect(isbnLabel('9780134078779')).toBe('ISBN 9780134078779');
    expect(isbnLabel('')).toBe('');
  });
});

describe('scanning a frame', () => {
  function fitDetector(values: string[]) {
    const detect = vi.fn().mockResolvedValue(values.map((rawValue) => ({ rawValue })));
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        detect = detect;
      },
    );
    return detect;
  }

  it('says no where the browser cannot scan', async () => {
    expect(canScan()).toBe(false);
    await expect(scanFrame(new Blob())).resolves.toBe('');
  });

  it('finds the book among whatever else is in shot', async () => {
    fitDetector(['5000112637922', '9780134078779']);
    expect(canScan()).toBe(true);
    await expect(scanFrame(new Blob())).resolves.toBe('9780134078779');
  });

  it('is silent on a frame with nothing in it', async () => {
    // Called repeatedly against a live camera, so a miss is the normal case.
    fitDetector([]);
    await expect(scanFrame(new Blob())).resolves.toBe('');
  });

  it('is silent when the decoder throws', async () => {
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        detect() {
          throw new Error('unreadable frame');
        }
      },
    );
    await expect(scanFrame(new Blob())).resolves.toBe('');
  });
});
