"""Build the complete Semester book as a list of chapters (HTML files + inserted document PDFs).
Writes book/full/chapters.json and book/full/ch-*.html."""
import json, re, html, os, sys, glob
import markdown
from PIL import Image

S = sys.argv[1]
P = S + '/live/project'
B = S + '/book'
F = B + '/full'
os.makedirs(F + '/slices', exist_ok=True)
esc = html.escape

def md(text):
    return markdown.markdown(text, extensions=['tables', 'fenced_code', 'sane_lists'])

def readp(p):
    return open(P + '/' + p, encoding='utf-8').read()

# ---------- screenshot inventory
crawl = {}
for f in glob.glob(B + '/crawl/index-*.json'):
    crawl.update(json.load(open(f)))
shots = json.load(open(B + '/shots.json'))
dshots = {s['name']: s for s in json.load(open(B + '/shots-dark.json'))}

MAX_RATIO = 1.22  # height/width that fits one page at full width

def sliced(path, key):
    """Return list of image paths, slicing very tall screenshots into page-sized pieces."""
    im = Image.open(path)
    if im.width > 1200:
        im = im.resize((1200, int(im.height * 1200 / im.width)), Image.LANCZOS)
    w, h = im.size
    if h / w <= MAX_RATIO:
        if path.endswith('.png'):
            return [path]
        p = f'{F}/slices/{key}-r.jpg'
        if not os.path.exists(p):
            im.convert('RGB').save(p, quality=62)
        return [p]
    out = []
    step = int(w * MAX_RATIO * 0.95)
    y = 0; i = 0
    while y < h:
        y2 = min(h, y + step)
        if h - y2 < step * 0.15:
            y2 = h
        p = f'{F}/slices/{key}-{i:02d}.jpg'
        if not os.path.exists(p):
            im.crop((0, y, w, y2)).convert('RGB').save(p, quality=62)
        out.append(p); y = y2; i += 1
    return out

def fig(path, caption='', key=None, maxw='100%'):
    key = key or re.sub(r'\W+', '-', os.path.basename(path))
    parts = sliced(path, key)
    out = []
    for i, p in enumerate(parts):
        cap = caption + (f' <span class="cont">({i+1}/{len(parts)})</span>' if len(parts) > 1 else '')
        out.append(f'<figure class="shot"><img src="{p}" style="max-width:{maxw}"><figcaption>{cap}</figcaption></figure>')
    return ''.join(out)

chapters = []

def chapter(cid, part, title, body, kicker='', intro=''):
    doc = f'<section class="chapter"><div class="kicker">{esc(part)}{(" · " + esc(kicker)) if kicker else ""}</div><h1>{esc(title)}</h1>'
    if intro:
        doc += f'<p class="intro">{intro}</p>'
    doc += body + '</section>'
    chapters.append({'kind': 'html', 'id': cid, 'part': part, 'title': title, 'body': doc})

def insert_pdf(cid, part, title, path):
    if os.path.exists(path):
        chapters.append({'kind': 'pdf', 'id': cid, 'part': part, 'title': title, 'path': path})

def divider(part, num, title, lede):
    chapters.append({'kind': 'html', 'id': 'part-' + str(num), 'part': part, 'title': f'Part {num} — {title}', 'divider': True,
                     'body': f'<section class="divider"><div class="pnum">Part {num}</div><div class="ptitle">{esc(title)}</div><p class="plede">{lede}</p></section>'})

def md_chapter(cid, part, title, paths, kicker='', intro=''):
    body = ''
    for p in paths:
        if os.path.exists(P + '/' + p):
            body += f'<div class="doc"><div class="src">{esc(p)}</div>' + md(readp(p)) + '</div>'
    if body:
        chapter(cid, part, title, body, kicker, intro)

def kit_chapter(cid, part, title, kit_ids, intro='', kicker='Screens'):
    body = ''
    n = 0
    for kid in kit_ids:
        k = crawl.get(kid)
        if not k or not k['shots']:
            continue
        if len(kit_ids) > 1:
            body += f'<h2>{esc(k.get("title") or kid)}</h2>'
        for s in k['shots']:
            n += 1
            lab = 'Opening view' if s['label'] == 'Start' else s['label']
            body += fig(B + '/crawl/' + s['file'], esc(lab), key=s['file'][:-4])
    if body:
        chapter(cid, part, title, body, kicker, intro + (f' <b>{n} screens.</b>' if n > 1 else ''))
    return n

def readme_section(name):
    """Pull one '## name' section out of the README."""
    r = readp('README.md')
    m = re.search(r'^## ' + re.escape(name) + r'.*?$(.*?)(?=^## |\Z)', r, re.S | re.M)
    return m.group(1).strip() if m else ''

total_screens = 0

# =====================================================================
# FRONT MATTER
readme = readp('README.md')
intro_paras = re.split(r'\n## ', readme, maxsplit=1)[0]
intro_paras = re.sub(r'^# .*\n', '', intro_paras)

# =====================================================================
PART1 = 'Company'
divider(PART1, 1, 'Company', 'What Semester is, who it serves, how the company is run, financed, staffed and governed — and the strategy for winning.')
chapter('c-overview', PART1, 'Semester at a glance', '<div class="prose">' + md(intro_paras) + md('## Sources\n' + readme_section('Sources')) + '</div>' +
        fig(B + '/shots/comp-Cover.png', 'The system cover'), 'Overview')
md_chapter('c-business-system', PART1, 'The company operating system', [
    'docs/business/README.md', 'docs/business/COMPANY_OPERATING_SYSTEM.md', 'docs/business/COMPANY_OPERATING_CADENCE.md',
    'docs/business/COMPANY_KPI_TREE.md', 'docs/business/BUSINESS_SYSTEMS_OF_RECORD.md', 'docs/business/OPERATIONS_COMMAND_CENTER.md'], 'Business')
md_chapter('c-gtm', PART1, 'Go-to-market, revenue and marketing', [
    'docs/business/GTM_AND_SALES_SYSTEM.md', 'docs/business/revenue/GTM_AND_REVENUE_OPERATIONS.md', 'docs/business/REVENUE_OPERATIONS.md',
    'docs/business/MARKETING_AND_BRAND_SYSTEM.md', 'docs/business/PARTNERSHIPS_AND_MARKETPLACE.md',
    'docs/business/CUSTOMER_SUCCESS_AND_IMPLEMENTATION.md', 'docs/business/customer/CUSTOMER_SUCCESS_AND_IMPLEMENTATION.md'], 'Business')
insert_pdf('c-gtm-plan', PART1, 'Go-to-market plan and price book', B + '/docpdf/grow-GTM-Plan.pdf')
insert_pdf('c-market', PART1, 'Market and competitor research', B + '/docpdf/kitdoc-business-Market-Research.pdf')
md_chapter('c-finance', PART1, 'Finance and capital', [
    'docs/business/FINANCE_AND_CAPITAL_SYSTEM.md', 'docs/business/finance/FINANCE_AND_ACCOUNTING_OPERATIONS.md',
    'docs/business/BOARD_AND_INVESTOR_OPERATIONS.md'], 'Business')
insert_pdf('c-finmodel', PART1, 'Finance model', B + '/docpdf/run-Finance-Model.pdf')
md_chapter('c-people', PART1, 'People and hiring', ['docs/business/PEOPLE_AND_HIRING_SYSTEM.md', 'docs/business/people/PEOPLE_HIRING_AND_CULTURE.md'], 'Business')
insert_pdf('c-hiring', PART1, 'Hiring plan and job descriptions', B + '/docpdf/run-Hiring-Plan.pdf')
md_chapter('c-gov', PART1, 'Governance, legal, risk and vendors', [
    'docs/business/CORPORATE_GOVERNANCE_AND_LEGAL_OPS.md', 'docs/business/BUSINESS_RISK_REGISTER.md',
    'docs/business/RISK_RESILIENCE_AND_CONTINUITY.md', 'docs/business/VENDOR_AND_PROCUREMENT_SYSTEM.md',
    'docs/business/DATA_RESEARCH_AND_OUTCOMES.md', 'docs/business/BUSINESS_MASTER_BACKLOG.md'], 'Business')
md_chapter('c-strategy', PART1, 'Strategy', sorted('docs/strategy/' + f for f in os.listdir(P + '/docs/strategy')), 'Strategy',
           'The competitive plan, moats, AI differentiation, ecosystem, implementation and outcome-proof programs.')
insert_pdf('c-opmanual', PART1, 'Operating manual', B + '/docpdf/kitdoc-business-Operating-Manual.pdf')
insert_pdf('c-oppack', PART1, 'Company operating pack', B + '/docpdf/kitdoc-business-Operating-Pack.pdf')
for kid, t in [('tpl-InvestorDeck', 'Investor deck'), ('tpl-CompanyDeck', 'Company deck'), ('tpl-VisionDeck', 'Vision deck'),
               ('tpl-InternalPlanDeck', 'Internal plan deck')]:
    total_screens += kit_chapter('c-' + kid, PART1, t, [kid], 'Every slide, rendered from the deck template.', 'Deck')
total_screens += kit_chapter('c-kits', PART1, 'Company workspaces', ['kit-business', 'kit-investor', 'kit-master-control', 'kit-company-site'],
                             'The business workspace, investor room, master control and the public company site.')
for t in ['Pilot-One-Pager', 'Pilot-Invitation-Email', 'Vanderbilt-Campus-Map']:
    total_screens += kit_chapter('c-kd-' + t, PART1, t.replace('-', ' '), ['kitdoc-business-' + t], '', 'Document')
for d in ['legal-Master-Services-Agreement', 'legal-Order-Form', 'legal-Data-Protection-Addendum', 'legal-Subprocessors',
          'legal-Terms-of-Service', 'legal-Privacy-Policy', 'legal-Cookie-Notice', 'legal-Accessibility-Statement', 'legal-Community-Guidelines']:
    insert_pdf('c-' + d, PART1, d.split('-', 1)[1].replace('-', ' '), B + '/docpdf/' + d + '.pdf')

# =====================================================================
PART2 = 'Product'
divider(PART2, 2, 'Product', 'Every feature, function, workflow, role and capability — and every screen of the student, staff, institution and external experiences.')
insert_pdf('p-onepager', PART2, 'Product brief (one-pager)', B + '/docpdf/brief-One-pager.pdf')
insert_pdf('p-faq', PART2, 'FAQ', B + '/docpdf/brief-FAQ.pdf')
insert_pdf('p-roles', PART2, 'What Semester does for each role', B + '/docpdf/brief-Role-sheets.pdf')
insert_pdf('p-userguide', PART2, 'User guide', B + '/docpdf/guides-User-Guide.pdf')
md_chapter('p-master', PART2, 'The Semester OS master map', ['docs/master/README.md', 'docs/master/SEMESTER_OS_MASTER_MAP.md'], 'Catalog')
md_chapter('p-systems', PART2, 'Systems and capabilities', ['docs/master/SEMESTER_SYSTEM_CATALOG.md', 'docs/platform/README.md',
           'docs/platform/DAILY_STUDENT_EXPERIENCE_STANDARD.md', 'docs/platform/AI_INTELLIGENCE_PLATFORM.md'], 'Catalog')
md_chapter('p-roles-cat', PART2, 'Roles', ['docs/master/SEMESTER_ROLE_CATALOG.md'], 'Catalog')
md_chapter('p-screens-cat', PART2, 'Screen catalog — every screen', ['docs/master/SEMESTER_SCREEN_CATALOG.md'], 'Catalog')
md_chapter('p-workflows', PART2, 'Workflow catalog — every workflow', ['docs/master/SEMESTER_WORKFLOW_CATALOG.md',
           'docs/system/workflows/SEMESTER_WORKFLOW_ARCHITECTURE.md', 'docs/system/workflows/SEMESTER_WORKFLOW_CATALOG.md'], 'Catalog')
md_chapter('p-consoles', PART2, 'Consoles', ['docs/master/SEMESTER_CONSOLE_CATALOG.md'], 'Catalog')
md_chapter('p-data', PART2, 'Data domains, education graph and integrations', ['docs/master/SEMESTER_DATA_DOMAIN_CATALOG.md',
           'docs/master/SEMESTER_EDUCATION_GRAPH.md', 'docs/platform/EDUCATION_GRAPH_ROADMAP.md', 'docs/master/SEMESTER_INTEGRATION_CATALOG.md',
           'docs/platform/INTEGRATION_AND_MIGRATION_FACTORY.md'], 'Catalog')
md_chapter('p-algos', PART2, 'Algorithms and intelligence', sorted('docs/system/algorithms/' + f for f in os.listdir(P + '/docs/system/algorithms')), 'Functions')
md_chapter('p-dataprov', PART2, 'Data, provenance and source authority', sorted('docs/system/data/' + f for f in os.listdir(P + '/docs/system/data')), 'Functions')
md_chapter('p-gates', PART2, 'Release gates and documents', ['docs/master/SEMESTER_RELEASE_GATE_CATALOG.md', 'docs/master/SEMESTER_DOCUMENT_CATALOG.md'], 'Catalog')
md_chapter('p-gaps', PART2, 'Gap register', ['docs/master/SEMESTER_GAP_REGISTER.md'], 'Catalog')
md_chapter('p-trace', PART2, 'Traceability matrix', ['docs/master/SEMESTER_TRACEABILITY_MATRIX.md'], 'Catalog',
           'Every requirement traced to the screens, workflows and tests that satisfy it.')
md_chapter('p-platform', PART2, 'Platform roadmap and maturity', ['docs/platform/PLATFORM_36_MONTH_ROADMAP.md', 'docs/platform/PLATFORM_MATURITY_MODEL.md',
           'docs/platform/PLATFORM_READINESS_SCORECARD.md', 'docs/platform/ORGANIZATIONAL_MATURITY_MODEL.md', 'docs/platform/PLATFORM_ECONOMICS.md',
           'docs/platform/DISTRIBUTION_ENGINE.md', 'docs/platform/DEVELOPER_PLATFORM_AND_MARKETPLACE.md', 'docs/platform/GLOBAL_EXPANSION_ARCHITECTURE.md',
           'docs/platform/RESEARCH_AND_OUTCOMES_ENGINE.md', 'docs/platform/PLATFORM_RISK_REGISTER.md'], 'Platform')
md_chapter('p-kits-readme', PART2, 'The product prototypes', [], '')
chapter('p-kits-intro', PART2, 'The product prototypes', '<div class="prose">' + md(readme_section('UI kits') + '\n\n' + readme_section('Design System tab, group by group')) + '</div>', 'Screens')
kits = [
    ('kit-student', 'Student app — every destination', 'The student experience: Today, Plan, Learn, Help, Campus, Progress and Me.'),
    ('kit-mobile', 'Student mobile app', 'The same destinations on a phone, with the labelled bottom tab bar.'),
    ('kit-staff', 'Staff workspaces', 'Faculty, TA, advisor, registrar, finance and student-affairs workspaces.'),
    ('staffws', 'Staff workspaces (standalone build)', ''),
    ('kit-console', 'Institution console', 'Approvals, integrations, security, support queue and audit for institution admins.'),
    ('kit-external', 'External roles', 'Applicant, guardian, alumni, employer and partner experiences.'),
    ('kit-every-screen', 'Every screen', 'The full screen inventory, one entry per screen.'),
    ('kit-gap-screens', 'Gap screens', 'Screens rendered to close gaps in the register.'),
    ('kit-one-place', 'One place', ''), ('kit-role-pages', 'Role pages', ''), ('kit-role-lens', 'Role lens', 'The product seen through each role.'),
    ('kit-atlas', 'Atlas', ''), ('kit-master-catalog', 'Master catalog', 'Searchable catalog of systems, screens and workflows.'),
    ('kit-workflow-runner', 'Workflow runner and capability map', 'Run any workflow step by step; the OS capability map.'),
    ('kit-platform-maturity', 'Platform maturity', ''), ('kit-community', 'Community', ''), ('kit-forms', 'Forms', ''),
    ('kit-wireframes', 'Wireframes', ''), ('kit-demo-video', 'Demo video', ''),
]
for kid, t, i in kits:
    total_screens += kit_chapter('p-' + kid, PART2, t, [kid], i)
for kid, t in [('tpl-PlatformShell', 'Platform shell'), ('tpl-StudentScreen', 'Student screen template'), ('tpl-InstitutionOs', 'Institution OS'),
               ('tpl-ConsoleScreen', 'Console screen template'), ('tpl-PrivacyCenter', 'Privacy center'), ('tpl-QuickStart', 'Student quick start'),
               ('tpl-DomainMap', 'Education OS domain map'), ('tpl-OperatingMap', 'Master operating map'), ('tpl-FinishLine', 'Finish line'),
               ('tpl-ProductOverviewDeck', 'Product overview deck'), ('tpl-OverviewDeck', 'Product overview deck'), ('tpl-InstitutionDeck', 'Institution buyer deck'),
               ('tpl-ResearchBrief', 'Research brief'), ('tpl-PilotResultsReport', 'Pilot results report'), ('tpl-ProductTeaser', 'Product teaser')]:
    total_screens += kit_chapter('p-' + kid, PART2, t, [kid], '', 'Template')
onb = sorted(k for k in crawl if k.startswith('tpl-Onboarding') or k == 'tpl-RoleOnboarding')
total_screens += kit_chapter('p-onboarding', PART2, 'Role onboarding — every role', onb, 'First-run onboarding for each of the 13 roles.')

# =====================================================================
PART3 = 'Brand'
divider(PART3, 3, 'Brand', 'Identity, voice, the mark and logo system, iconography, imagery and launch materials.')
md_chapter('b-identity', PART3, 'Brand identity', ['docs/system/design/SEMESTER_BRAND_IDENTITY.md', 'docs/system/design/SEMESTER_VISUAL_LANGUAGE.md'], 'Identity')
chapter('b-voice', PART3, 'Voice and content', '<div class="prose">' + md('## Content fundamentals\n' + readme_section('CONTENT FUNDAMENTALS')) + '</div>' +
        fig(B + '/shots/guide-voice.png', 'Voice — prefer / avoid'), 'Voice')
logo_body = ''
for n, cap in [('LogoSystem', 'Logo system'), ('LogoMark', 'Logo mark'), ('WordmarkLockup', 'Wordmark lockup')]:
    logo_body += fig(B + f'/shots/comp-{n}.png', cap)
logos = sorted(glob.glob(P + '/assets/logo-*.svg')) + [P + '/assets/logo-mark-silver.png', P + '/assets/logo-mark-512.png', P + '/assets/apple-touch-icon.png', P + '/assets/favicon.svg']
logo_body += '<h2>Every logo file</h2><div class="assetgrid">' + ''.join(
    f'<div class="asset {"dark" if ("reversed" in l or "white" in l) else ""}"><img src="{l}"><div class="an">{esc(os.path.basename(l))}</div></div>' for l in logos if os.path.exists(l)) + '</div>'
chapter('b-logos', PART3, 'The mark and logo system', logo_body, 'Logos')
icons = sorted(glob.glob(P + '/assets/icons/*.svg'))
ib = fig(B + '/shots/comp-Iconography.png', 'Iconography overview') + fig(B + '/shots/guide-iconography-rules.png', 'Iconography rules')
ib += f'<h2>The complete icon set ({len(icons)} glyphs)</h2><div class="icongrid">' + ''.join(
    f'<div class="ic"><img src="{i}"><div>{esc(os.path.basename(i)[:-4])}</div></div>' for i in icons) + '</div>'
chapter('b-icons', PART3, 'Iconography', '<div class="prose">' + md(readme_section('ICONOGRAPHY')) + '</div>' + ib, 'Icons')
total_screens += kit_chapter('b-launch', PART3, 'Launch kit', ['kit-launch-kit'] + sorted(k for k in crawl if k.startswith('kitdoc-launch-kit')),
                             'Welcome and incident emails, sponsor update, staff flier, data hosting map and the 3D mark.')
md_chapter('b-launch-readme', PART3, 'Launch kit notes', ['ui_kits/launch-kit/README.md'], 'Launch')
total_screens += kit_chapter('b-poster', PART3, 'Launch poster', ['tpl-LaunchPoster'], '', 'Poster')

# =====================================================================
PART4 = 'Design system'
divider(PART4, 4, 'Design system', 'Tokens, foundations, every component in light and dark, patterns and the deep-dive guidelines.')
# reuse the first book's chapters by importing its builder output
first = open(B + '/book.html', encoding='utf-8').read()
body = re.search(r'<body>(.*)</body>', first, re.S).group(1)
secs = re.findall(r'(<section class="chapter" id="([^"]+)">.*?</section>)', body, re.S)
names = {'brandbook': 'Design system brand book (README)', 'tokens': 'Design tokens', 'foundations': 'Foundations',
         'brand': 'Brand specimens', 'components': 'Components (light)', 'patterns': 'Patterns', 'guidelines': 'Guidelines', 'appendix': 'Architecture and tooling cards'}
for sec, sid in secs:
    chapters.append({'kind': 'html', 'id': 'ds-' + sid, 'part': PART4, 'title': names.get(sid, sid), 'body': sec})
dark = ''
for s in sorted([s for s in shots if s['kind'] == 'comp' and s['meta'].get('group') not in (None, 'Brand')], key=lambda x: (x['meta']['group'], x['name'])):
    d = dshots.get(s['name'])
    if d:
        dark += f'<div class="pair"><h3>{esc(s["name"])} <span class="g">{esc(s["meta"]["group"])}</span></h3><div class="two"><img src="{B}/shots/{s["file"]}"><img src="{B}/shots-dark/{d["file"]}"></div></div>'
chapter('ds-dark', PART4, 'Every component, light and dark', dark, 'Themes', 'Each component in Parchment (light, left) and Ink (dark, right).')
md_chapter('ds-docs', PART4, 'Design language', ['docs/system/README.md', 'docs/system/design/SEMESTER_UI_GRAMMAR.md', 'docs/system/design/SEMESTER_COMPONENT_LIBRARY.md',
           'docs/system/design/SEMESTER_INTERACTION_LANGUAGE.md', 'docs/system/design/SEMESTER_MOTION_AND_FEEDBACK.md',
           'docs/system/design/SEMESTER_RESPONSIVE_STRATEGY.md', 'docs/system/design/SEMESTER_DATA_TRUST_UI.md'], 'Language')
md_chapter('ds-figma', PART4, 'Figma mapping and design-system baseline', ['handoff/claude-code-toolkit/docs/design-system/README.md',
           'handoff/claude-code-toolkit/docs/design-system/SEMESTER-DESIGN-SYSTEM-BASELINE.md', 'handoff/claude-code-toolkit/docs/design-system/FIGMA-MAPPING.md'], 'Tooling')

# =====================================================================
PART5 = 'Operating'
divider(PART5, 5, 'Operating', 'How Semester is run day to day: operations, support, launch, security, trust and compliance.')
md_chapter('o-support', PART5, 'Support and service operations', ['docs/business/SUPPORT_AND_SERVICE_OPERATIONS.md'], 'Operations')
insert_pdf('o-handbook', PART5, 'Operations handbook', B + '/docpdf/operate-Operations-Handbook.pdf')
insert_pdf('o-runbooks', PART5, 'Runbooks', B + '/docpdf/operate-Runbooks.pdf')
insert_pdf('o-launchrb', PART5, 'Pilot launch runbook', B + '/docpdf/launch-Launch-Runbook.pdf')
insert_pdf('o-cutover', PART5, 'Production cutover plan', B + '/docpdf/launch-Cutover-Plan.pdf')
insert_pdf('o-supportplan', PART5, 'Day-1 and week-1 support plan', B + '/docpdf/launch-Support-Plan.pdf')
md_chapter('o-trust', PART5, 'Trust program', ['docs/business/TRUST_PROGRAM.md', 'docs/business/trust/SECURITY_PRIVACY_ACCESSIBILITY_COMPLIANCE.md',
           'docs/platform/ENTERPRISE_TRUST_PROGRAM.md', 'docs/platform/RELIABILITY_AND_GLOBAL_OPERATIONS.md'], 'Trust')
insert_pdf('o-secpol', PART5, 'Security policy set', B + '/docpdf/secure-Security-Policies.pdf')
insert_pdf('o-secready', PART5, 'Security readiness tracker', B + '/docpdf/secure-Security-Readiness.pdf')
insert_pdf('o-secreview', PART5, 'Platform security review', B + '/docpdf/secure-Platform-Security-Review.pdf')
total_screens += kit_chapter('o-kits', PART5, 'Operations and compliance consoles', ['kit-ops', 'kit-compliance'], 'The operations consoles and the compliance workspace.')
total_screens += kit_chapter('o-cc', PART5, 'Company command center', ['tpl-CommandCenter'], '', 'Template')

# =====================================================================
PART6 = 'Building'
divider(PART6, 6, 'Building', 'How Semester is built: architecture, engineering practice, testing, the build plan and what comes next.')
insert_pdf('k-arch', PART6, 'Architecture guide', B + '/docpdf/guides-Architecture-Guide.pdf')
md_chapter('k-tiers', PART6, 'Three-tier architecture and API contract', ['docs/platform/THREE_TIER_ARCHITECTURE.md', 'docs/platform/API_CONTRACT_STANDARD.md'], 'Architecture')
arch = ''.join(fig(B + f'/shots/guide-{n}.png', n.replace('-', ' ')) for n in ['arch-layers', 'arch-read-model', 'arch-ai-gateway', 'arch-environments', 'maps-of-the-whole'])
chapter('k-archcards', PART6, 'Architecture cards', arch, 'Architecture')
total_screens += kit_chapter('k-archkit', PART6, 'Architecture explorer', ['kit-architecture'], 'Interactive architecture of stack layers, read models, AI gateway and environments.')
insert_pdf('k-dev', PART6, 'Developer guide', B + '/docpdf/guides-Developer-Guide.pdf')
insert_pdf('k-playbook', PART6, 'Engineering playbook', B + '/docpdf/build-Engineering-Playbook.pdf')
md_chapter('k-prodeng', PART6, 'Product and engineering operations', ['docs/business/PRODUCT_AND_ENGINEERING_OPERATIONS.md'], 'Engineering')
insert_pdf('k-qa', PART6, 'QA test plan', B + '/docpdf/build-QA-Test-Plan.pdf')
insert_pdf('k-a11y', PART6, 'Accessibility test plan', B + '/docpdf/build-Accessibility-Test-Plan.pdf')
md_chapter('k-handoff', PART6, 'Build handoff', ['handoff/README.md', 'handoff/BUILD.md'], 'Build')
md_chapter('k-execute', PART6, 'Execution plan, step by step', sorted('handoff/execute/' + f for f in os.listdir(P + '/handoff/execute')), 'Build')
md_chapter('k-modules', PART6, 'Code packages', ['handoff/semester-core/README.md', 'handoff/semester-platform/README.md', 'handoff/workflow-router-app/README.md'], 'Build')
md_chapter('k-toolkit', PART6, 'Claude Code toolkit', ['handoff/claude-code-toolkit/README.md', 'handoff/claude-code-toolkit/EXECUTE.md',
           'handoff/claude-code-toolkit/PROMPTS.md', 'handoff/claude-code-toolkit/CLAUDE.md.design-system-section.md'], 'Tooling')
tools = ''.join(fig(B + f'/shots/guide-{n}.png', n.replace('-', ' ')) for n in ['tooling-semester-core', 'tooling-semester-platform', 'tooling-workflow-router', 'tooling-claude-code', 'company-documents'])
chapter('k-toolcards', PART6, 'Tooling cards', tools, 'Tooling')
total_screens += kit_chapter('k-lab', PART6, 'AI workflow router and benchmark lab', ['kit-workflow-lab'], '')
md_chapter('k-lab-readme', PART6, 'Prototype notes', ['ui_kits/workflow-lab/README.md', 'ui_kits/student/README.md', 'ui_kits/staff/README.md',
           'ui_kits/console/README.md', 'ui_kits/mobile/README.md'], 'Notes')
md_chapter('k-github', PART6, 'Prototype-to-codebase map', ['github.md'], 'Code')
md_chapter('k-next', PART6, "What's next", ['NEXT-SESSION.md'], 'Roadmap')
insert_pdf('k-library', PART6, 'Document library index', B + '/docpdf/index.pdf')

json.dump({'chapters': chapters, 'screens': total_screens}, open(F + '/chapters.json', 'w'))
print('chapters', len(chapters), 'html', sum(c['kind'] == 'html' for c in chapters), 'pdf', sum(c['kind'] == 'pdf' for c in chapters), 'screens', total_screens)
missing = [k for k in crawl if not any(k in json.dumps(c.get('body', '')) or k == c['id'][2:] for c in chapters)]
print('crawl ids:', len(crawl))
