/**
 * Reading the barcode off the back of a textbook.
 *
 * The costs screen is typed by hand, deliberately: the app refuses to fetch a
 * price, because prices differ by edition, by seller and by the week, and a
 * confident wrong one is worse than a blank field.
 *
 * That reasoning is about the *price*. It says nothing about the *title*,
 * which is printed on the back of every book as a barcode. Pointing the camera
 * that is already wired for photographing a whiteboard at an ISBN fills in the
 * one field you would otherwise thumb in, and changes nothing about the app's
 * refusal to guess what you paid.
 *
 * ## It stays offline
 *
 * The app reads the number and stops. Turning an ISBN into a title means
 * asking a book database, which means telling somebody else what this student
 * is studying — and the number itself, written next to what you paid, is
 * enough to find the book later. Detection runs on the device through the
 * browser's own decoder; nothing leaves the phone.
 *
 * ## Where it works
 *
 * `BarcodeDetector` is Chrome and Android. A polyfill exists and is a large
 * WebAssembly build, which is not worth a megabyte for one field — so the
 * button is hidden where the API is absent rather than shipped broken.
 */

/** The two formats a book carries. EAN-13 is the ISBN; the other is rarer. */
const FORMATS = ['ean_13', 'isbn' as const];

interface Detector {
  detect: (source: CanvasImageSource | Blob) => Promise<{ rawValue?: string }[]>;
}

interface DetectorCtor {
  new (options?: { formats?: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
}

function ctor(): DetectorCtor | null {
  try {
    const g = globalThis as unknown as { BarcodeDetector?: DetectorCtor };
    return g.BarcodeDetector ?? null;
  } catch {
    return null;
  }
}

/** Whether this browser can read a barcode at all. */
export function canScan(): boolean {
  return ctor() !== null;
}

/**
 * An ISBN, tidied.
 *
 * A scanner returns digits with no separators; a person copying from a book
 * types them with hyphens and spaces. Both end up the same, and anything that
 * is not a 10- or 13-digit book number comes back empty rather than being
 * stored as a number that means nothing.
 */
export function readIsbn(raw: string): string {
  const digits = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (digits.length === 13 && /^(978|979)\d{10}$/.test(digits)) return digits;
  if (digits.length === 10 && /^\d{9}[\dX]$/.test(digits)) return digits;
  return '';
}

/** "ISBN 978…" — how it reads next to what you paid. */
export function isbnLabel(isbn: string): string {
  return isbn ? `ISBN ${isbn}` : '';
}

/**
 * Look for a book barcode in one frame.
 *
 * Returns the first ISBN it finds, or empty. A frame with no barcode in it is
 * the normal case — this is called repeatedly against a live camera — so a
 * miss is silence rather than an error.
 */
export async function scanFrame(source: CanvasImageSource | Blob): Promise<string> {
  const Ctor = ctor();
  if (!Ctor) return '';
  try {
    const detector = new Ctor({ formats: FORMATS });
    const found = await detector.detect(source);
    for (const hit of found) {
      const isbn = readIsbn(hit.rawValue ?? '');
      if (isbn) return isbn;
    }
    return '';
  } catch {
    // A frame the decoder could not read, or a detector that refused the
    // format list. Both are a miss, not a failure worth showing.
    return '';
  }
}
