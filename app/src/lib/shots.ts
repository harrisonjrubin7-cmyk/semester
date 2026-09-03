/**
 * Photographs, made ready to send.
 *
 * A phone camera produces a 12-megapixel JPEG of about 4 MB. Sent as-is that is
 * slow to upload on campus wifi, close to the API's per-image ceiling, and
 * billed for far more tokens than the picture is worth: images are charged by
 * area, and past roughly 1568px on the long edge the model gains nothing
 * because it downscales anyway. So every shot is re-drawn to fit that box and
 * re-encoded as JPEG before it goes anywhere.
 *
 * The formats the API accepts are JPEG, PNG, WebP and GIF. A phone may hand
 * over HEIC instead, which most browsers cannot decode — that case is detected
 * and explained rather than failing as a broken image.
 */

import type { Shot } from './claude';

/** The long edge the API stops gaining detail past. */
const MAX_EDGE = 1568;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface ShotFile {
  shot: Shot;
  name: string;
  /** Rough size of what will be sent, in KB, for the "N photos · 420 KB" line. */
  kb: number;
  /** A blob: URL for the thumbnail. Revoke it when the screen goes. */
  preview: string;
}

export class ShotError extends Error {}

function readAsImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new ShotError(
          /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
            ? `${file.name} is a HEIC photo, which this browser cannot open. On an iPhone, ` +
              'Settings → Camera → Formats → Most Compatible makes new photos JPEG; an existing ' +
              'one can be shared as a JPEG from the Photos app.'
            : `${file.name} could not be read as an image.`,
        ),
      );
    };
    img.src = url;
  });
}

/**
 * One file in, one ready-to-send shot out.
 *
 * Throws a {@link ShotError} whose message is meant to be shown to a person,
 * because every failure here is one they can do something about.
 */
export async function toShot(file: File): Promise<ShotFile> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|hei[cf])$/i.test(file.name)) {
    throw new ShotError(`${file.name} is not an image.`);
  }

  const img = await readAsImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ShotError('This browser would not give the app a canvas to resize with.');
  ctx.drawImage(img, 0, 0, w, h);

  // A GIF or PNG of a diagram keeps its own format when it is already small
  // enough; a photograph always becomes JPEG, where the size is won.
  const keep = ACCEPTED.includes(file.type) && file.size < 400_000 && scale === 1;
  const mediaType = keep ? file.type : 'image/jpeg';
  const url = keep ? await asDataUrl(file) : canvas.toDataURL('image/jpeg', 0.82);

  const data = url.slice(url.indexOf(',') + 1);
  return {
    shot: { mediaType, data },
    name: file.name,
    kb: Math.round((data.length * 0.75) / 1024),
    preview: canvas.toDataURL('image/jpeg', 0.5),
  };
}

function asDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new ShotError(`${file.name} could not be read.`));
    r.readAsDataURL(file);
  });
}

/**
 * A whole selection at once, with the failures reported rather than swallowed.
 *
 * Someone picking twenty photos out of a camera roll should not lose the batch
 * because one of them is a HEIC.
 */
export async function toShots(files: File[]): Promise<{ shots: ShotFile[]; errors: string[] }> {
  const shots: ShotFile[] = [];
  const errors: string[] = [];
  for (const f of files) {
    try {
      shots.push(await toShot(f));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { shots, errors };
}

/** Total payload of a set, in KB — what the screen shows before sending. */
export function weigh(shots: ShotFile[]): number {
  return shots.reduce((n, s) => n + s.kb, 0);
}

/**
 * How many can go in one request.
 *
 * The API takes up to 100 images and a 32 MB request. Twelve is the practical
 * limit for a phone photographing a board: past that the reply gets vague and
 * the wait gets long, and a student is better served sending two batches.
 */
export const MAX_SHOTS = 12;
