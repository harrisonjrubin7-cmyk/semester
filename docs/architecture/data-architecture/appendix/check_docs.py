#!/usr/bin/env python3
"""Documentation checks for docs/architecture/data-architecture/ (no dependencies).

    python3 appendix/check_docs.py          # from docs/architecture/data-architecture/

1. Every Markdown table has the same number of cells in every row. GFM splits on an unescaped pipe even
   inside a code span, so `a | b` in a cell silently adds a column.
2. Every relative link resolves to a file (and, for a #fragment into a Markdown file, to a heading).
3. Controls: a deliberately malformed table and a deliberately broken link are each caught, or the checker is blind.
Mermaid diagrams are checked separately (check_mermaid.mjs, needs `npm i mermaid jsdom`)."""
import pathlib, re, sys
root = pathlib.Path(__file__).resolve().parent.parent
def cells(line):
    parts = re.split(r'(?<!\\)\|', line.strip())
    if parts and parts[0] == '': parts = parts[1:]
    if parts and parts[-1] == '': parts = parts[:-1]
    return parts
def table_problems(text):
    out, lines, i, fence = [], text.split('\n'), 0, False
    while i < len(lines):
        if lines[i].startswith('```'): fence = not fence
        if not fence and lines[i].lstrip().startswith('|'):
            j = i
            while j < len(lines) and lines[j].lstrip().startswith('|'): j += 1
            n = len(cells(lines[i]))
            out += [(i + k + 1, len(cells(l)), n) for k, l in enumerate(lines[i:j]) if len(cells(l)) != n]
            i = j
        else: i += 1
    return out
def slug(h):  # GitHub heading anchor
    h = re.sub(r'[`*_]', '', h.strip().lower()); h = re.sub(r'[^\w\- ]', '', h); return h.replace(' ', '-')
def anchors(path):
    fence, out = False, set()
    for l in path.read_text().split('\n'):
        if l.startswith('```'): fence = not fence
        m = re.match(r'#{1,6}\s+(.*)', l)
        if m and not fence: out.add(slug(m.group(1)))
    return out
def link_problems(path, text):
    out = []
    for m in re.finditer(r'\[[^\]]*\]\(([^)\s]+)\)', re.sub(r'```.*?```', '', text, flags=re.S)):
        t = m.group(1)
        if re.match(r'^(https?:|mailto:)', t): continue
        f, _, frag = t.partition('#')
        target = (path.parent / f).resolve() if f else path
        if not target.exists(): out.append((t, 'missing file')); continue
        if frag and target.suffix == '.md' and slug(frag) not in anchors(target) and frag not in anchors(target):
            out.append((t, 'no such heading'))
    return out
bad = 0; ntab = nlink = 0
for p in sorted(root.glob('*.md')):
    text = p.read_text()
    for ln, got, want in table_problems(text): bad += 1; print(f'{p.name}:{ln}: table row has {got} cells, header {want}')
    for t, why in link_problems(p, text): bad += 1; print(f'{p.name}: link {t}: {why}')
    ntab += len(re.findall(r'^\|[-: |]+\|$', text, flags=re.M)); nlink += len(re.findall(r'\]\((?!https?:)[^)]+\)', text))
# controls
assert table_problems('| a | b |\n| - | - |\n| `x | y` | z |'), 'control failed: bad table not caught'
tmp = root / '__control.md'; tmp.write_text('[x](./does-not-exist.md) [y](README.md#no-such-heading)')
try: assert len(link_problems(tmp, tmp.read_text())) == 2, 'control failed: bad links not caught'
finally: tmp.unlink()
print(f'checked {ntab} tables and {nlink} relative links in {len(list(root.glob("*.md")))} files: {bad} problems; controls ok')
sys.exit(1 if bad else 0)
