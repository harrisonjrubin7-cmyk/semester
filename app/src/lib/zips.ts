/**
 * How large a zip this app will try to open, and why there is a limit at all.
 *
 * Every zip the app reads — a .docx syllabus, a .pptx deck, a .xlsx gradebook,
 * a folder of course material — goes through fflate's `unzipSync`, which
 * decompresses the whole archive into memory in one go and offers no way to
 * stop partway. So the only place a limit can be applied is before the call:
 * once it has started, a file claiming to hold a great deal is a frozen tab,
 * and no cap checked afterwards can undo that.
 *
 * `lib/xlsxin.ts` worked this out and guarded its two entry points. The other
 * three callers did not, and one of them said in so many words that its caps
 * were "checked against the *declared* sizes as entries come out rather than
 * after building every File" — true of the `File` objects it builds, and not
 * true of the decompression, which had already happened by the time the loop
 * that applies them runs.
 *
 * The number is deliberately far past anything genuine: a real .docx syllabus
 * is tens of kilobytes, a photo-heavy .pptx a few tens of megabytes, and this
 * app's own grid stops at 200×26. It is not a security boundary — a zip small
 * enough to pass can still expand to more than this — it is the difference
 * between a message and a tab that stops responding.
 */
export const MOST_PACKED = 64 * 1024 * 1024;

/** Whether a file is past the point where unpacking it is worth attempting. */
export function tooPacked(file: { size: number }): boolean {
  return file.size > MOST_PACKED;
}

/** How the limit reads to somebody who just picked the file. */
export function tooPackedSaid(name: string, advice: string): string {
  return (
    `${name} is too large for this app to open — anything past ` +
    `${Math.round(MOST_PACKED / 1024 / 1024)}MB is more than a browser tab can unpack. ${advice}`
  );
}
