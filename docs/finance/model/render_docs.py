"""Rewrite the pages in docs/finance/ from the model. Run after any change to spec.py.

Pages 00 (README) and 01-10 are rendered; none is edited by hand.
"""
import os, re, sys
import render_a, render_b, render_c

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)

PAGES = {
 'README.md': render_c.doc00,
 '01-ASSUMPTIONS-AND-EVIDENCE.md': render_b.doc01,
 '02-REVENUE-STREAMS-AND-PRICING.md': render_b.doc02,
 '03-COST-MODEL.md': render_b.doc03,
 '04-THREE-YEAR-MODEL.md': render_a.doc04,
 '05-UNIT-ECONOMICS-DASHBOARD.md': render_a.doc05,
 '06-SCENARIOS-AND-SENSITIVITIES.md': render_a.doc06,
 '07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md': render_c.doc07,
 '08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md': render_c.doc08,
 '09-FINANCIAL-CONTROLS-AND-FINANCE-OPERATIONS.md': render_c.doc09,
 '10-BOARD-REPORTING-PACKAGE.md': render_b.doc10,
}

HEADER = '<!-- Rendered by docs/finance/model/render_docs.py from the model. Edit the model (spec.py) or the renderer, then re-run it. -->\n\n'


def main(check_only=False):
    stale = []
    for name, fn in PAGES.items():
        text = HEADER + fn().rstrip() + '\n'
        path = os.path.join(OUT, name)
        if check_only:
            if not os.path.exists(path) or open(path).read() != text:
                stale.append(name)
        else:
            open(path, 'w').write(text)
    # every relative link must resolve
    bad = []
    for name in PAGES:
        text = open(os.path.join(OUT, name)).read() if not check_only else HEADER + PAGES[name]().rstrip() + '\n'
        for m in re.finditer(r'\]\(([^)#]+?)(#[^)]*)?\)', text):
            target = m.group(1)
            if target.startswith(('http', 'mailto')):
                continue
            if not os.path.exists(os.path.normpath(os.path.join(OUT, target))):
                bad.append((name, target))
    if bad:
        print('BROKEN LINKS:'); [print('  ', b) for b in bad]
    if stale:
        print('STALE PAGES (re-run render_docs.py):', stale)
    if not bad and not stale:
        print('pages current; all relative links resolve' if check_only else 'wrote %d pages; all relative links resolve' % len(PAGES))
    return 1 if (bad or stale) else 0


if __name__ == '__main__':
    sys.exit(main(check_only='--check' in sys.argv))
