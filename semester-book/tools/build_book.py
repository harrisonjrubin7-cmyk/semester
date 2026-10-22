import json, re, html, sys, os
import markdown

S = sys.argv[1]
P = S + '/live/project'
B = S + '/book'
BASE = 'http://127.0.0.1:8765'
shots = json.load(open(B + '/shots.json'))
tok = json.load(open(P + '/tokens.json'))
idx = open(P + '/components/index.d.ts', encoding='utf-8').read()

def md(text):
    return markdown.markdown(text, extensions=['tables', 'fenced_code', 'sane_lists'])

def esc(s):
    return html.escape(str(s))

def shot(name, kind='comp'):
    for s in shots:
        if s['kind'] == kind and s['name'] == name:
            return s
    return None

def img(s, maxw=None):
    w = s['w']
    disp = min(w, maxw or 680)
    return f'<figure class="shot"><img src="{B}/shots/{s["file"]}" style="width:{disp}px"></figure>'

# ---------- types per component
dts = {}
for part in re.split(r'\n// ---- ', idx)[1:]:
    name, _, body = part.partition('\n')
    dts[name.strip()] = body.strip()

# ---------- color helpers
colors = {t['name']: t for t in tok['color']['tokens']}
def resolve(name, theme, depth=0):
    v = colors[name]['value']
    if isinstance(v, dict):
        v = v.get(theme, v.get('light'))
    m = re.fullmatch(r'\{(.+)\}', v)
    if m and depth < 10:
        return resolve(m.group(1), theme, depth + 1)
    return v

def val_text(v):
    if isinstance(v, dict):
        return ' / '.join(f'{k}: {x}' for k, x in v.items())
    return v

parts = []
toc = []
def section(id_, title, sub=None):
    toc.append((id_, title))
    parts.append(f'<section class="chapter" id="{id_}"><div class="kicker">{esc(sub or "")}</div><h1>{esc(title)}</h1>')

def end():
    parts.append('</section>')

# ---------- cover
cover = shot('Cover')
parts.append(f'''<section class="cover">
<img class="coverimg" src="{B}/shots/{cover["file"]}">
<div class="covertext">
<div class="kicker">Complete reference</div>
<div class="covertitle">Semester Design System</div>
<p class="lede">Brand book, tokens, every component with a live-rendered example, brand assets, foundations, patterns and guidelines — exported from <i>The Main Semester design system</i>.</p>
<p class="meta">Exported 21 Oct 2026 · Namespace <code>window.SemesterDesignSystem_e9f3ba</code> · React 18</p>
</div></section>''')
parts.append('<!--TOC-->')

# ---------- 1 brand book
readme = open(P + '/README.md', encoding='utf-8').read()
readme = re.sub(r'^# .*\n', '', readme, count=1)
section('brandbook', 'Brand book', '1 · README')
parts.append('<div class="prose">' + md(readme) + '</div>')
end()

# ---------- 2 tokens
section('tokens', 'Design tokens', '2 · tokens.json')
parts.append(f'<p class="note">{esc(tok["color"].get("note",""))}</p>')
prim = [t for t in tok['color']['tokens'] if not isinstance(t['value'], dict) and not str(t['value']).startswith('{')]
sem = [t for t in tok['color']['tokens'] if t not in prim]
def color_rows(lst, two):
    rows = []
    for t in lst:
        l = resolve(t['name'], 'light'); d = resolve(t['name'], 'dark')
        sw = f'<span class="sw" style="background:{l}"></span>'
        if two:
            sw += f'<span class="sw" style="background:{d}"></span>'
        v = t['value']
        if two:
            lv = v.get('light', '') if isinstance(v, dict) else v
            dv = v.get('dark', lv) if isinstance(v, dict) else v
            cells = f'<td class="v">{esc(lv)}</td><td class="v">{esc(dv)}</td>'
        else:
            cells = f'<td class="v">{esc(v)}</td>'
        rows.append(f'<tr><td class="sws">{sw}</td><td class="nm"><code>{esc(t["name"])}</code></td>{cells}<td class="u">{esc(t.get("usage",""))}</td></tr>')
    return ''.join(rows)
parts.append('<h2>Colour — primitives</h2><table class="tok"><thead><tr><th></th><th>Token</th><th>Value</th><th>Usage</th></tr></thead><tbody>' + color_rows(prim, False) + '</tbody></table>')
parts.append('<h2>Colour — semantic (light · dark)</h2><table class="tok"><thead><tr><th>Light · Dark</th><th>Token</th><th>Light</th><th>Dark</th><th>Usage</th></tr></thead><tbody>' + color_rows(sem, True) + '</tbody></table>')

ty = tok['type']
parts.append('<h2>Typography</h2>')
parts.append(f'<p class="note">{esc(ty.get("note",""))}</p>')
parts.append('<table class="tok"><thead><tr><th>Family</th><th>Stack</th></tr></thead><tbody>' + ''.join(f'<tr><td><code>{esc(k)}</code></td><td class="v" style="font-family:{esc(v)}">{esc(v)}</td></tr>' for k, v in ty['families'].items()) + '</tbody></table>')
parts.append('<table class="tok"><thead><tr><th>Font file</th><th>Family</th><th>Weight</th></tr></thead><tbody>' + ''.join(f'<tr><td><code>{esc(f["file"])}</code></td><td>{esc(f["family"])}</td><td>{esc(f["weight"])}</td></tr>' for f in ty['fonts']) + '</tbody></table>')
for g in ty['groups']:
    parts.append(f'<h3>{esc(g["name"])}</h3><div class="specimens">')
    for st in g['styles']:
        parts.append(f'<div class="spec"><div class="specmeta"><code>{esc(st["name"])}</code> · {esc(st["fontSize"])} / {esc(st["lineHeight"])} · {esc(st["fontWeight"])} · {esc(st["family"])}<div class="u">{esc(st.get("usage",""))}</div></div><div class="{esc(st["name"])} specline">Your lab report is due Thursday</div></div>')
    parts.append('</div>')

def simple_family(key, title, visual=None):
    fam = tok[key]
    parts.append(f'<h2>{title}</h2>')
    if fam.get('note'):
        parts.append(f'<p class="note">{esc(fam["note"])}</p>')
    rows = []
    for t in fam['tokens']:
        vis = visual(t) if visual else ''
        rows.append(f'<tr><td><code>{esc(t["name"])}</code></td><td class="v">{esc(t["value"])}</td><td class="vis">{vis}</td><td class="u">{esc(t.get("usage",""))}</td></tr>')
    parts.append('<table class="tok"><thead><tr><th>Token</th><th>Value</th><th></th><th>Usage</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table>')

simple_family('spacing', 'Spacing', lambda t: f'<span class="bar" style="width:{t["value"]}"></span>')
simple_family('radius', 'Radius', lambda t: f'<span class="rad" style="border-radius:{t["value"]}"></span>')
simple_family('shadow', 'Shadow', lambda t: f'<span class="shad" style="box-shadow:{t["value"]}"></span>')
simple_family('size', 'Sizes and targets')
simple_family('layer', 'Layers (z-index)')
simple_family('leading', 'Leading (line height)')
simple_family('tracking', 'Tracking (letter spacing)')
end()

# ---------- 3 foundations specimens
def gallery(title_id, title, sub, names, intro=None):
    section(title_id, title, sub)
    if intro:
        parts.append(f'<p class="note">{esc(intro)}</p>')
    for n in names:
        s = shot(n, 'guide') or shot(n, 'comp')
        if not s:
            continue
        nm = s['meta'].get('name') or {'LogoSystem':'Logo system','LogoMark':'Logo mark','WordmarkLockup':'Wordmark lockup'}.get(n) or n.replace('-', ' ').capitalize()
        subt = s['meta'].get('subtitle', '')
        parts.append(f'<div class="card"><h3>{esc(nm)}</h3><div class="sub">{esc(subt)}</div>{img(s)}</div>')
    end()

gallery('foundations', 'Foundations', '3 · Specimen pages',
        ['colors-grounds', 'colors-accents', 'colors-metals', 'colors-dark-components', 'dataviz',
         'type-scale', 'type-display', 'type-headings', 'type-body', 'type-labels',
         'spacing', 'density', 'layout', 'motion', 'states-interaction'])
gallery('brand', 'Brand', '4 · Logos, mark, icons, voice',
        ['LogoSystem', 'LogoMark', 'WordmarkLockup', 'Iconography', 'iconography-rules', 'voice'])

# ---------- 5 components
section('components', 'Components', '5 · Live-rendered examples')
parts.append('<p class="note">Every component in <code>components/bundle.js</code>, rendered from its preview. Each entry gives its guide (README.md) and its props (from <code>components/index.d.ts</code>).</p>')
order = ['Actions', 'AI', 'Data', 'Forms', 'Glyph', 'Navigation', 'States', 'Surfaces', 'Trust & provenance', 'Governance']
comps = [s for s in shots if s['kind'] == 'comp' and s['meta'].get('group') not in (None, 'Brand')]
groups = {}
for s in comps:
    groups.setdefault(s['meta']['group'], []).append(s)
for g in order + [x for x in groups if x not in order]:
    if g not in groups:
        continue
    parts.append(f'<h2 class="grp">{esc(g)}</h2>')
    for s in sorted(groups[g], key=lambda x: x['name']):
        n = s['name']
        rd = P + f'/components/{n}/README.md'
        guide = md(open(rd, encoding='utf-8').read()) if os.path.exists(rd) else ''
        types = dts.get(n, '')
        types_html = f'<details open><summary>Props</summary><pre class="dts">{esc(types)}</pre></details>' if types else ''
        parts.append(f'<div class="comp"><h3>{esc(n)}</h3>{img(s)}<div class="prose small">{guide}</div>{types_html}</div>')
end()

# ---------- 6 patterns
gallery('patterns', 'Patterns', '6 · Composed flows',
        ['pattern-ai-anatomy', 'pattern-provenance-ladder', 'pattern-source-line', 'pattern-consent', 'pattern-consequential', 'pattern-state-matrix'])

# ---------- 7 guidelines
section('guidelines', 'Guidelines', '7 · Deep dives')
for f in sorted(os.listdir(P + '/guidelines')):
    if f.endswith('.md'):
        parts.append('<div class="prose guide">' + md(open(P + '/guidelines/' + f, encoding='utf-8').read()) + '</div>')
end()

# ---------- 8 appendix
gallery('appendix', 'Architecture and tooling', '8 · Appendix',
        ['maps-of-the-whole', 'arch-layers', 'arch-read-model', 'arch-ai-gateway', 'arch-environments',
         'company-documents', 'tooling-semester-core', 'tooling-semester-platform', 'tooling-workflow-router', 'tooling-claude-code'])

toc_html = '<section class="toc"><div class="kicker">Contents</div><h1>Contents</h1><ol>' + ''.join(
    f'<li><a href="#{i}">{esc(t)}</a></li>' for i, t in toc) + '</ol><p class="note">Not included: the business, platform, strategy and handoff documents that sit alongside the system, the UI kits and templates, and anything in <code>archived/</code> or <code>uploads/</code>.</p></section>'
body = '\n'.join(parts).replace('<!--TOC-->', toc_html)

css = open(B + '/book.css', encoding='utf-8').read()
doc = f'''<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>Semester Design System — Complete reference</title>
<link rel="stylesheet" href="tokens.css"><style>{css}</style></head><body>{body}</body></html>'''
open(B + '/book.html', 'w', encoding='utf-8').write(doc)
print('ok', len(doc), 'components', len(comps))
