import { describe, expect, it } from 'vitest';
import { stripMetadata, UnsupportedUpload } from './metadata';

const enc = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const has = (bytes: Uint8Array, needle: string) => {
  const hay = String.fromCharCode(...bytes);
  return hay.includes(needle);
};

function segment(marker: number, payload: number[]): number[] {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 0xff, ...payload];
}

function jpeg(): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    ...segment(0xe0, enc('JFIF\0')),
    ...segment(0xe1, enc('Exif\0\0GPSLatitude 36.14 camera=Pixel')),
    ...segment(0xfe, enc('comment: taken in my dorm')),
    ...segment(0xdb, [0, 1, 2, 3]),
    0xff, 0xda, 0, 4, 1, 2, 9, 9, 9,
    0xff, 0xd9,
  ]);
}

function chunk(type: string, data: number[]): number[] {
  const len = data.length;
  return [len >>> 24, (len >> 16) & 255, (len >> 8) & 255, len & 255, ...enc(type), ...data, 0, 0, 0, 0];
}

function png(): Uint8Array {
  return new Uint8Array([
    0x89, ...enc('PNG\r\n\x1a\n'),
    ...chunk('IHDR', new Array(13).fill(1)),
    ...chunk('tEXt', enc('Location\0Branscomb Hall')),
    ...chunk('eXIf', enc('GPSLatitude')),
    ...chunk('IDAT', [1, 2, 3]),
    ...chunk('IEND', []),
  ]);
}

describe('stripMetadata', () => {
  it('removes EXIF and comments from a JPEG, keeps the image segments', () => {
    const input = jpeg();
    expect(has(input, 'GPSLatitude')).toBe(true); // control: the probe can see it
    const { kind, bytes } = stripMetadata(input);
    expect(kind).toBe('jpeg');
    expect(has(bytes, 'GPSLatitude')).toBe(false);
    expect(has(bytes, 'dorm')).toBe(false);
    expect(has(bytes, 'JFIF')).toBe(true);
    expect(bytes.slice(-2)).toEqual(new Uint8Array([0xff, 0xd9]));
  });

  it('removes text and EXIF chunks from a PNG', () => {
    const input = png();
    expect(has(input, 'Branscomb')).toBe(true);
    const { bytes } = stripMetadata(input);
    expect(has(bytes, 'Branscomb')).toBe(false);
    expect(has(bytes, 'GPSLatitude')).toBe(false);
    expect(has(bytes, 'IDAT')).toBe(true);
    expect(has(bytes, 'IEND')).toBe(true);
  });

  it('refuses anything it cannot parse rather than passing it through', () => {
    expect(() => stripMetadata(new Uint8Array(enc('%PDF-1.7 ...')))).toThrow(UnsupportedUpload);
    expect(() => stripMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]))).toThrow(UnsupportedUpload);
  });
});
