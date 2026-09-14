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

/**
 * XML text escaping. Every string that reaches any of the three files goes
 * through here.
 *
 * All three writers had their own copy, character for character the same. Of
 * everything the three shared this is the one worth naming: the five entities
 * are the difference between a professor's name with an ampersand in it and a
 * file that will not open, and the control-character strip is the difference
 * between text pasted out of a PDF and the same. A string that is legal in
 * JavaScript and illegal in XML 1.0 produces a document that downloads, opens,
 * and is rejected as corrupt — on somebody else's machine, after it has been
 * sent. One copy, one set of tests.
 */
export function xml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // A control character is legal in a JS string and not in XML 1.0.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}
