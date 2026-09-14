/**
 * The two strings every Office file starts with.
 *
 * `lib/docx.ts`, `lib/pptx.ts` and `lib/xlsx.ts` each write a different
 * format, and almost nothing is shared between them — a slide is not a row is
 * not a paragraph, and trying to make one writer serve all three would be the
 * abstraction that costs more than it saves. These two are the exception.
 *
 * `HEAD` is the XML declaration OOXML requires at the top of every part, down
 * to `standalone="yes"`, and `REL` is the relationships namespace every one of
 * the three refers to. Both were typed out in all three files — `REL` twice
 * inside `pptx.ts` alone, once in a namespace string and once as a constant —
 * and a typo in either produces a file that downloads, opens, and is rejected
 * as corrupt, which is the worst failure this app has: it happens on somebody
 * else's machine, after they have already sent it to a professor.
 *
 * So these two are here and the rest stays where it is used.
 */

export const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

export const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
