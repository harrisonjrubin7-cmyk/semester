// Browser helpers for the private file store. Downloads become a local object URL in this tab only.
import { files } from 'zitejs/api';
import { checkUpload } from './fileRules';

export const toB64 = (buf: ArrayBuffer) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

/** Uploads to the private store and returns the file id. Throws with a readable message on refusal. */
export async function uploadPrivate(f: File, purpose: 'personal' | 'submission' | 'evidence'): Promise<string> {
  const why = checkUpload(f.name, f.type, f.size);
  if (why) throw new Error(why);
  const r = (await files({ action: 'upload', name: f.name, mime: f.type, purpose, base64: toB64(await f.arrayBuffer()) })) as { id: string };
  return r.id;
}

/** Saves bytes returned by an authorized endpoint as a download. */
export function saveBytes(r: { name: string; mime: string; base64: string }) {
  const bin = atob(r.base64); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: r.mime }));
  const a = document.createElement('a'); a.href = url; a.download = r.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
