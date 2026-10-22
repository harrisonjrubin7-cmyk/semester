import json, sys, os, subprocess, html
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import io
S=sys.argv[1]; B=S+'/book'; F=B+'/full'; OUT=sys.argv[2]
BK=sys.argv[3]; d=json.load(open(BK)); ch=d['chapters']; F=B+'/three/'+os.path.basename(BK)[:-5]; os.makedirs(F,exist_ok=True)
css=f'<link rel="stylesheet" href="file://{B}/tokens.css"><link rel="stylesheet" href="file://{B}/full.css">'
def page(body, title='Semester'):
    return f'<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>{title}</title>{css}</head><body>{body}</body></html>'
jobs=[]
for c in ch:
    if c['kind']=='html':
        h=f"{F}/ch-{c['id']}.html"; open(h,'w',encoding='utf-8').write(page(c['body'])); c['pdf']=f"{F}/ch-{c['id']}.pdf"
        if not os.path.exists(c['pdf']) or os.path.getmtime(c['pdf'])<os.path.getmtime(h) or '--force' in sys.argv:
            jobs.append({'html':h,'pdf':c['pdf']})
    else: c['pdf']=c['path']
# cover
cov=f'''<section style="height:9.7in;position:relative;background:var(--parchment-bg);margin:-0.65in -0.6in -0.8in;padding:0;height:11in;width:8.5in;overflow:hidden">
<img src="{B}/shots/comp-Cover.png" style="width:8.5in;display:block">
<div style="position:absolute;left:.75in;right:.75in;bottom:1.1in">
<div class="kicker">The Semester books</div>
<div style="font-family:var(--font-display);font-weight:600;font-size:34pt;line-height:1.05;margin:8pt 0 14pt">{d["title"]}</div>
<div style="font-family:var(--font-heading);font-weight:600;font-size:20pt;line-height:1.2;margin-bottom:14pt">{d["sub"]}</div>
<p class="lede">One of three books that together cover everything about Semester: Book 1 Company, Brand &amp; Operating · Book 2 Product · Book 3 Design System &amp; Building. Compiled from <i>The Main Semester design system</i>.</p>
<p class="meta">Edition of 21 October 2026 · Pre-seed, founder-led · Large figures are labelled sample data</p></div></section>'''
open(F+'/cover.html','w').write(page(cov)); jobs.append({'html':F+'/cover.html','pdf':F+'/cover.pdf'})
json.dump(jobs,open(F+'/render.json','w'))
subprocess.run(['node',B+'/render.js',F+'/render.json'],check=True,env=dict(os.environ,NODE_PATH=S+'/tools/node_modules'))
counts=[len(PdfReader(c['pdf']).pages) for c in ch]
def toc_html(start):
    rows=''; part=None; n=start
    for c,k in zip(ch,counts):
        if c['part']!=part:
            part=c['part']; rows+=f'<div class="tp">{html.escape(part)}</div>'
        if not c.get('divider'):
            rows+=f'<div class="te"><span class="t">{html.escape(c["title"])}</span><span class="n">{n}</span></div>'
        c['start']=n; n+=k
    return page(f'<section class="toc2"><div class="kicker">Contents</div><h1>Contents</h1>{rows}</section>')
open(F+'/toc.html','w').write(toc_html(3))
subprocess.run(['node',B+'/render.js','/dev/stdin'],input=json.dumps([{'html':F+'/toc.html','pdf':F+'/toc.pdf'}]).encode(),check=True,env=dict(os.environ,NODE_PATH=S+'/tools/node_modules'))
tp=len(PdfReader(F+'/toc.pdf').pages)
open(F+'/toc.html','w').write(toc_html(2+tp))
subprocess.run(['node',B+'/render.js','/dev/stdin'],input=json.dumps([{'html':F+'/toc.html','pdf':F+'/toc.pdf'}]).encode(),check=True,env=dict(os.environ,NODE_PATH=S+'/tools/node_modules'))
assert len(PdfReader(F+'/toc.pdf').pages)==tp
w=PdfWriter()
for p in PdfReader(F+'/cover.pdf').pages[:1]: w.add_page(p)
for p in PdfReader(F+'/toc.pdf').pages: w.add_page(p)
parts={}
for c in ch:
    r=PdfReader(c['pdf'])
    for p in r.pages: w.add_page(p)
for c in ch:
    idx=c['start']-1
    if c.get('divider'):
        parts[c['part']]=w.add_outline_item(c['title'],idx)
    else:
        w.add_outline_item(c['title'],idx,parent=parts.get(c['part']))
# stamp footers
total=len(w.pages)
for i,pg in enumerate(w.pages):
    if i==0: continue
    W=float(pg.mediabox.width); H=float(pg.mediabox.height)
    buf=io.BytesIO(); cv=canvas.Canvas(buf,pagesize=(W,H)); cv.setFont('Helvetica',7); cv.setFillColorRGB(.45,.45,.45)
    cv.drawString(43,24,d['title'].replace(' · ',' — ')); cv.drawRightString(W-43,24,f'{i+1} / {total}'); cv.save()
    buf.seek(0); pg.merge_page(PdfReader(buf).pages[0])
w.add_metadata({'/Title':'Semester — '+d['title'],'/Author':'Harrison Rubin'})
w.compress_identical_objects() if hasattr(w,'compress_identical_objects') else None
with open(OUT,'wb') as f: w.write(f)
print('pages',total,'toc pages',tp,'size MB',round(os.path.getsize(OUT)/1e6,1))
