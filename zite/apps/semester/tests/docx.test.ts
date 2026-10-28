import { test, eq } from './harness';
import { parse, inline, words, toDocx } from '../src/lib/docxRules';

const MD = `# Market failure

Adverse selection is in **Akerlof** (*1970*). See [the paper](https://doi.org/10.2307/1879431).

## Causes
- Hidden information
- Hidden action
  - Moral hazard

1. Define it
2. Give an example

> Quoted line

| Market | Problem |
|---|---|
| Used cars | Lemons |

---
\`\`\`
=SUM(A1)
\`\`\`
[bad](javascript:alert(1)) & <tag>`;

test('inline: bold, italic, code and safe links only', () => {
  eq(inline('a **b** *c* `d` [e](https://x.org)'), [{ text: 'a ' }, { text: 'b', b: true }, { text: ' ' }, { text: 'c', i: true }, { text: ' ' }, { text: 'd', code: true }, { text: ' ' }, { text: 'e', href: 'https://x.org' }]);
  eq(inline('[x](javascript:alert(1))')[0].href, undefined);
});
test('parse finds every block type in order', () => {
  eq(parse(MD).map((b) => b.t), ['h', 'p', 'h', 'li', 'li', 'li', 'li', 'li', 'quote', 'table', 'hr', 'code', 'p']);
  const li = parse(MD).filter((b) => b.t === 'li') as { depth: number; ordered: boolean; list: number }[];
  eq(li.map((l) => [l.depth, l.ordered, l.list]), [[0, false, 1], [0, false, 1], [1, false, 1], [0, true, 2], [0, true, 2]]);
});
test('word count ignores markup (control: empty is 0)', () => { eq(words(''), 0); eq(words('# Hi there\n\n**bold** word'), 4); });
test('docx is a zip with document, styles, numbering and a hyperlink relationship', () => {
  const t = new TextDecoder().decode(toDocx('Notes <1>', MD));
  eq(t.startsWith('PK'), true);
  eq(['word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml'].every((n) => t.includes(n)), true);
  eq(t.includes('<w:pStyle w:val="Heading1"/>') && t.includes('<w:pStyle w:val="Heading2"/>') && t.includes('<w:tbl>'), true);
  eq(t.includes('Target="https://doi.org/10.2307/1879431" TargetMode="External"'), true);
  eq(t.includes('javascript:'), true); // kept only as literal text …
  eq(/Target="javascript/.test(t), false); // … never as a link target
  eq(t.includes('&amp; &lt;tag&gt;') && t.includes('Notes &lt;1&gt;'), true);
});
