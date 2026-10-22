import os, re, io
from pypdf import PdfReader, PdfWriter
OUT='/home/claude/outputs/Semester in 20 parts'
books=['Semester Book 1 — Company, Brand & Operating.pdf','Semester Book 2 — Product.pdf','Semester Book 3 — Design System & Building.pdf']
short=['Company, Brand & Operating','Product','Design System & Building']
units=[]  # (book idx, start, end, title, parent)
readers=[]
for bi,b in enumerate(books):
    r=PdfReader('/home/claude/outputs/'+b); readers.append(r)
    flat=[]
    def walk(items,parent=None):
        last=None
        for it in items:
            if isinstance(it,list): walk(it,last)
            else:
                flat.append((r.get_destination_page_number(it),it.title,parent.title if parent else None)); last=it
    walk(r.outline)
    flat.sort(key=lambda x:x[0])
    starts=[0]+[p for p,_,_ in flat if p>0]
    starts=sorted(set(starts))
    titles={}
    for p,t,par in flat: titles.setdefault(p,(t,par))
    titles.setdefault(0,('Cover and contents',None))
    for i,s in enumerate(starts):
        e=starts[i+1] if i+1<len(starts) else len(r.pages)
        units.append((bi,s,e,titles[s][0],titles[s][1]))
alloc={0:4,1:10,2:6}
def partition(sizes,k):
    # linear partition minimising the largest part
    n=len(sizes); import itertools
    pre=[0]+list(itertools.accumulate(sizes))
    INF=float('inf'); dp=[[INF]*(k+1) for _ in range(n+1)]; cut=[[0]*(k+1) for _ in range(n+1)]
    dp[0][0]=0
    for i in range(1,n+1):
        for j in range(1,min(k,i)+1):
            for m in range(j-1,i):
                v=max(dp[m][j-1],pre[i]-pre[m])
                if v<dp[i][j]: dp[i][j]=v; cut[i][j]=m
    res=[]; i=n; j=k
    while j>0:
        m=cut[i][j]; res.append((m,i)); i=m; j-=1
    return res[::-1]
parts=[]
for bi in range(3):
    us=[u for u in units if u[0]==bi]
    for a,b in partition([u[2]-u[1] for u in us],alloc[bi]): parts.append(us[a:b])
# ensure book boundaries are not required; just write
for k,p in enumerate(parts,1):
    wr=PdfWriter()
    for bi,s,e,t,par in p:
        start=len(wr.pages)
        for i in range(s,e): wr.add_page(readers[bi].pages[i])
        wr.add_outline_item(f'{short[bi]} — {t}',start)
    first=p[0]; last=p[-1]
    bks=sorted({short[u[0]] for u in p},key=short.index)
    name=f'Semester Part {k:02d} of {len(parts)} — {" + ".join(bks)} — {first[3][:40]}'.replace('/','-')
    name=re.sub(r'\s+',' ',name).strip()+'.pdf'
    wr.add_metadata({'/Title':name[:-4]})
    wr.compress_identical_objects(remove_identicals=True, remove_orphans=True)
    path=f'{OUT}/{name}'
    with open(path,'wb') as f: wr.write(f)
    os.system(f'qpdf --compress-streams=y --object-streams=generate "{path}" "{path}.tmp" && mv "{path}.tmp" "{path}"')
    print(f'{k:02d} {len(wr.pages):4d}p {os.path.getsize(path)/1e6:5.1f}MB {name}')
