"""Split the full book into three books and add overviews, data catalogs, screen index and source-code appendices.
Usage: python3 build3.py <scratchpad>   -> writes book/three/bookN.json"""
import json, os, sys, glob, html, re
import markdown
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_data import render

S = sys.argv[1]
B = S + '/book'
P = S + '/live/project'
OLD = S + '/artifact-files/b9db20af-cdd6-4d53-95bf-0562b836a26e/project'
T = B + '/three'
os.makedirs(T, exist_ok=True)
esc = html.escape
md = lambda t: markdown.markdown(t, extensions=['tables', 'fenced_code', 'sane_lists'])
full = json.load(open(B + '/full/chapters.json'))
ch = full['chapters']

def section(cid, part, title, body, kicker='', intro=''):
    doc = f'<section class="chapter"><div class="kicker">{esc(part)}{(" · " + esc(kicker)) if kicker else ""}</div><h1>{esc(title)}</h1>'
    if intro: doc += f'<p class="intro">{intro}</p>'
    return {'kind': 'html', 'id': cid, 'part': part, 'title': title, 'body': doc + body + '</section>'}

def divider(part, num, title, lede):
    return {'kind': 'html', 'id': f'div-{num}-{re.sub(r"\W+", "-", title)}', 'part': part, 'title': title, 'divider': True,
            'body': f'<section class="divider"><div class="pnum">{esc(num)}</div><div class="ptitle">{esc(title)}</div><p class="plede">{lede}</p></section>'}

def overview(n, part):
    f = f'{B}/overviews/book{n}.md'
    if not os.path.exists(f):
        return []
    text = open(f, encoding='utf-8').read()
    text = re.sub(r'^# .*\n', '', text)
    secs = re.split(r'\n(?=## )', '\n' + text)
    out = []
    for s in secs:
        s = s.strip()
        if not s: continue
        m = re.match(r'## (.*)\n', s)
        title = m.group(1).strip() if m else 'Overview'
        body = s[m.end():] if m else s
        out.append(section(f'ov{n}-{re.sub(r"\W+", "-", title).lower()}', part, title, '<div class="prose doc ov">' + md(body) + '</div>', 'Overview'))
    return out

def data_chapter(cid, part, title, files, intro=''):
    body = ''
    for f, name in files:
        p = f'{B}/data/{f}'
        if os.path.exists(p):
            body += f'<div class="doc"><div class="src">{esc(name)}</div>' + render(json.load(open(p)), 2) + '</div>'
    return [section(cid, part, title, body, 'Data catalog', intro)] if body else []

def code_chapter(cid, part, title, paths, intro=''):
    body = ''
    for root, rel in paths:
        p = root + '/' + rel
        if not os.path.exists(p): continue
        txt = open(p, encoding='utf-8', errors='replace').read()
        body += f'<div class="code"><div class="src">{esc(rel.replace(".txt", ""))} · {txt.count(chr(10)) + 1} lines</div><pre>{esc(txt)}</pre></div>'
    return [section(cid, part, title, body, 'Source code', intro)] if body else []

def pick(parts):
    return [c for c in ch if c['part'] in parts]

# ---------------- screen index
crawl = {}
for f in glob.glob(B + '/crawl/index-*.json'):
    crawl.update(json.load(open(f)))
def screen_index(prefixes, part):
    rows = ''
    n = 0
    for k in sorted(crawl):
        if not k.startswith(prefixes): continue
        v = crawl[k]
        labels = ['Opening view' if s['label'] == 'Start' else s['label'] for s in v['shots']]
        n += len(labels)
        rows += f'<tr><td><b>{esc(v.get("title") or k)}</b></td><td class="num">{len(labels)}</td><td>{esc(" · ".join(labels))}</td></tr>'
    return section('screen-index-' + part.lower().replace(' ', '-'), part, 'Index of every captured screen',
                   f'<table class="dt"><thead><tr><th>Prototype / template</th><th>Screens</th><th>Screens captured (by the control that opens them)</th></tr></thead><tbody>{rows}</tbody></table>',
                   'Index', f'{n} screens, listed by the prototype they come from and the navigation that opens each one.')

books = []

# ================= BOOK 1 =================
b1 = []
b1 += [divider('Overview', 'Book 1', 'Company, Brand & Operating', 'What Semester is and how the company is built, positioned, presented and run.')]
b1 += overview(1, 'Overview')
b1 += pick(['Company'])
b1 += data_chapter('d1-company', 'Company', 'Company data catalogs', [
    ('ui_kits_company-os_company-os-data.js.json', 'Company OS — ui_kits/company-os/company-os-data.js'),
    ('ui_kits_business_business-data.js.json', 'Business workspace — ui_kits/business/business-data.js'),
    ('ui_kits_business_extras.js.json', 'Business extras and launch plan — ui_kits/business/extras.js'),
    ('ui_kits_business_gtm-copy.js.json', 'Go-to-market copy — ui_kits/business/gtm-copy.js')],
    'The structured data behind the company workspaces: operating streams, owners, metrics, plans and copy.')
b1 += pick(['Brand'])
b1 += pick(['Operating'])
b1 += data_chapter('d1-ops', 'Operating', 'Operations console data', [('ui_kits_ops_consoles-data.js.json', 'Operations consoles — ui_kits/ops/consoles-data.js')],
                   'Every console, role and institution configuration modelled in the operations prototype.')
books.append(('book1', 'Book 1 · Company, Brand & Operating', 'Company · Brand · Operating', b1))

# ================= BOOK 2 =================
b2 = [divider('Overview', 'Book 2', 'Product', 'Every feature, function, workflow, role and capability, and every screen.')]
b2 += overview(2, 'Overview')
b2 += pick(['Product'])
b2 += data_chapter('d2-catalog', 'Product', 'Product data catalogs', [
    ('ui_kits_master-catalog_catalog-data.js.json', 'Master catalog — ui_kits/master-catalog/catalog-data.js'),
    ('ui_kits_workflow-runner_os-map-data.js.json', 'OS capability map — ui_kits/workflow-runner/os-map-data.js'),
    ('ui_kits_workflow-runner_runner-data.js.json', 'Workflow runner — ui_kits/workflow-runner/runner-data.js'),
    ('ui_kits_platform-maturity_platform-data.js.json', 'Platform maturity — ui_kits/platform-maturity/platform-data.js'),
    ('ui_kits_role-pages_roles-data.js.json', 'Role pages — ui_kits/role-pages/roles-data.js'),
    ('ui_kits_role-lens_roles.js.json', 'Role lens — ui_kits/role-lens/roles.js'),
    ('ui_kits_every-screen_every-data.js.json', 'Every screen — ui_kits/every-screen/every-data.js'),
    ('ui_kits_one-place_one-place-data.js.json', 'One place — ui_kits/one-place/one-place-data.js'),
    ('ui_kits_atlas_atlas-data.js.json', 'Atlas — ui_kits/atlas/atlas-data.js'),
    ('ui_kits_community_community.js.json', 'Community — ui_kits/community/community.js')],
    'The structured data that drives the product prototypes: every capability, workflow step, role, screen and maturity score, rendered as tables.')
b2 += [screen_index(('kit-', 'tpl-', 'staffws', 'kitdoc-'), 'Product')]
books.append(('book2', 'Book 2 · Product', 'Features · Functions · Workflows · Roles · Every screen', b2))

# ================= BOOK 3 =================
b3 = [divider('Overview', 'Book 3', 'Design System & Building', 'The complete design system and how Semester is architected, built, tested and shipped.')]
b3 += overview(3, 'Overview')
b3 += pick(['Design system'])
b3 += pick(['Building'])
comp_src = sorted(os.path.relpath(p, OLD) for p in glob.glob(OLD + '/components/*/*.jsx'))
comp_src += ['components/trust/vocabulary.js', 'components/core/markPaths.js']
b3 += [divider('Source code', 'Appendix', 'Source code', 'The stylesheets, types, component sources and every engineering package, in full.')]
b3 += code_chapter('src-tokens', 'Source code', 'Token and component stylesheets', [(P, 'tokens.css'), (P, 'components/bundle.css'), (P, 'styles.css')],
                   'The generated token stylesheet and the component stylesheet, in full.')
b3 += code_chapter('src-types', 'Source code', 'Component types', [(P, 'components/index.d.ts')], 'Every component\'s props, as TypeScript declarations.')
b3 += code_chapter('src-components', 'Source code', 'Component sources', [(OLD, p) for p in comp_src], 'The JSX source of every component in the bundle.')
def tree(prefix):
    return sorted(os.path.relpath(p, OLD) for p in glob.glob(OLD + '/' + prefix + '/**/*', recursive=True) if os.path.isfile(p) and not p.endswith('.md'))
b3 += code_chapter('src-core', 'Source code', 'semester-core package', [(OLD, p) for p in tree('handoff/semester-core')],
                   'Access, AI gateway, approvals, consequence, freshness, next action, pilot, provenance and scoring logic, with tests.')
b3 += code_chapter('src-platform', 'Source code', 'semester-platform: API, security, migrations and tests', [(OLD, p) for p in tree('handoff/semester-platform')],
                   'API routes, input validation, AI redaction, security middleware, every database migration, seed data and the test suites.')
b3 += code_chapter('src-router', 'Source code', 'Workflow router and benchmark app', [(OLD, p) for p in tree('handoff/workflow-router-app')])
b3 += code_chapter('src-toolkit', 'Source code', 'Claude Code toolkit scripts and build scripts', [(OLD, p) for p in tree('handoff/claude-code-toolkit')] +
                   [(OLD, 'handoff/install.sh'), (OLD, 'handoff/preflight.sh'), (OLD, 'handoff/verify.sh'), (OLD, 'handoff/manifest.json')])
books.append(('book3', 'Book 3 · Design System & Building', 'Design system · Architecture · Engineering · Source code', b3))

for key, title, sub, chs in books:
    json.dump({'title': title, 'sub': sub, 'chapters': chs, 'screens': full['screens']}, open(f'{T}/{key}.json', 'w'))
    print(key, len(chs), 'chapters')

# ---------------- source research appendices (the founder's own uploaded research), added per book
U = P + '/uploads/'
RES = {
 'book1': ['Apple vs Google vs Microsoft in EdTech_ build a st.pdf', 'Build a comprehensive go-to-market playbook and la-b3b875c9.pdf',
           'Business Master Checklist_ legal, finance, sales,-351cbeb5.pdf', 'Draft the master GTM playbook prompt_Generate the copy-34d912a2.pdf',
           'Draft the master GTM playbook prompt_Generate the-44d9b8bf.pdf', 'Show the finance and accounting operations section.pdf',
           'gtm.pdf', 'nextsteps.pdf', 'chatgpt.pdf', 'expand on eveything you can possiably thing of to-7f714e1f.pdf'],
 'book2': ['Map Out entire Semester OS.pdf', 'Map semester out as a whol provide full map out of.pdf', 'Central Education OS architecture map_ how Semeste.pdf',
           'expand evan further provide prompt and comand to e.pdf', 'expand further on brand identy algorthims workflow.pdf',
           'list every artifact and thing for claud to genrate.pdf'],
 'book3': ['Semester build Architecture.pdf', 'Build a read-model architecture dashboard for your.pdf', 'Build an interactive CQRS read-model dashboard for-5b710f1a.pdf',
           'Interactive CQRS simulator_ model event lag, proje.pdf', 'Front-end compliance audit_ WCAG 2.2 criteria, FTC-12fe4b9d.pdf', 'scan.pdf',
           'now do same thing as it applies to front end and c-745ec881.pdf', 'building semester design system tell me everything copy-de061c9e.pdf',
           'building semester design system tell me everything.pdf', 'provide comand to claud code to excute on this and.pdf',
           'audit [https___github.com_harrisonjrubin7-cmyk_sem (3) copy.pdf'],
}
for key, title, sub, chs in books:
    extra = [divider('Source research', 'Appendix', 'Source research', 'The research reports and planning documents the founder gathered while building Semester, reproduced in full.')]
    if key == 'book1':
        v = crawl.get('upl-vision-deck')
        if v and v['shots']:
            body = ''.join(f'<figure class="shot"><img src="{B}/crawl/{s["file"]}"><figcaption>{esc(s["label"])}</figcaption></figure>' for s in v['shots'])
            extra.append(section('upl-vision', 'Source research', 'Semester Vision Deck (offline edition)', body, 'Deck'))
        extra.append(section('upl-mark', 'Source research', 'The original lit silver mark', f'<figure class="shot"><img src="{U}download-1.png" style="max-width:60%"><figcaption>uploads/download-1.png</figcaption></figure>', 'Image'))
    if key == 'book3':
        arch = ''.join(f'<h2>{esc(crawl[k]["title"])}</h2>' + ''.join(f'<figure class="shot"><img src="{B}/crawl/{s["file"]}"></figure>' for s in crawl[k]['shots'])
                       for k in sorted(crawl) if k.startswith('arch-') and k != 'arch-dsref' and crawl[k]['shots'])
        extra.insert(0, section('archive', 'Archive', 'Archive: the pre-migration cards and specimens', arch, 'Archive',
                                'The original group cards and specimen pages, as they rendered before the system moved to the new format. They are kept in archived/.'))
        extra.insert(0, divider('Archive', 'Appendix', 'Archive', 'Everything moved aside during the migration, still rendered as it was.'))
    for f in RES[key]:
        if os.path.exists(U + f):
            extra.append({'kind': 'pdf', 'id': 'upl-' + re.sub(r'\W+', '-', f)[:40], 'part': 'Source research', 'title': re.sub(r'(-[0-9a-f]{8})?\.pdf$', '', f).replace('_', ':'), 'path': U + f})
    chs.extend(extra)
    k = 0
    for c in chs:
        m = re.match(r'Part (\d+) — (.*)', c['title'])
        if c.get('divider') and m:
            k += 1
            c['title'] = f'Part {k} — {m.group(2)}'
            c['body'] = c['body'].replace(f'>Part {m.group(1)}<', f'>Part {k}<')
    json.dump({'title': title, 'sub': sub, 'chapters': chs, 'screens': full['screens']}, open(f'{T}/{key}.json', 'w'))
    print(key, len(chs), 'chapters (with research)')
