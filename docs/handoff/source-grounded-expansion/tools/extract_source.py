"""Decode Semester export metadata without executing uploaded JavaScript."""
import ast, base64, gzip, hashlib, json, re, sys
from html.parser import HTMLParser
from pathlib import Path
class Blocks(HTMLParser):
    def __init__(self): super().__init__(); self.current=None; self.parts={}
    def handle_starttag(self,tag,attrs):
        if tag=='script':
            kind=dict(attrs).get('type','')
            if kind.startswith('__bundler/'): self.current=kind;self.parts[kind]=[]
    def handle_endtag(self,tag):
        if tag=='script': self.current=None
    def handle_data(self,data):
        if self.current:self.parts[self.current].append(data)

def derive(rows,catalog):
    names={t['fq'] for t in catalog['tables']};functions={f['fq'] for f in catalog['fns']}
    result=[];seen=set()
    for row in rows:
        if len(row)!=11 or not all(isinstance(x,str) for x in row):raise ValueError('invalid source capability row')
        cid,ws,area,routes,actors,perms,records,commands,events,screens,design=row
        if cid in seen:raise ValueError('duplicate capability '+cid)
        seen.add(cid)
        result.append(dict(id=cid,workspace=ws,area=area,routes=routes.split(),actors=actors.split(),permissions=perms.split(),records=records.split(),commands=commands.split(),events=events.split(),screen_types=screens.split(),design_declared=design,missing_records=[x for x in records.split() if x not in names],missing_commands=[x for x in commands.split() if x not in functions],implementation_status='unknown'))
    return result

def extract(path):
    source=Path(path).read_bytes();parser=Blocks();parser.feed(source.decode('utf8'))
    parts={k:''.join(v) for k,v in parser.parts.items()}
    manifest=json.loads(parts['__bundler/manifest']);template=json.loads(parts['__bundler/template'])
    assets=[];texts=[]
    for uid,entry in manifest.items():
        data=base64.b64decode(entry['data'],validate=True)
        if entry.get('compressed'):data=gzip.decompress(data)
        assets.append(dict(uuid=uid,mime=entry['mime'],bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
        if 'javascript' in entry['mime']:texts.append(data.decode('utf8'))
    candidates=[x for x in texts if re.search(r'^window\.DB_CATALOG=',x,re.M)]
    registries=[x for x in texts if x.startswith('// Semester capability registry.') and 'const R = [' in x]
    if len(candidates)!=1 or len(registries)!=1:raise ValueError('ambiguous source payloads')
    catalog=json.JSONDecoder().raw_decode(candidates[0].split('window.DB_CATALOG=',1)[1])[0]
    matched=re.search(r'const R = (\[.*?\n  \]);',registries[0],re.S)
    if not matched:raise ValueError('unsupported capability format')
    literal=re.sub(r'^\s*//.*$','',matched.group(1),flags=re.M)
    rows=ast.literal_eval(literal)
    return dict(source_sha256=hashlib.sha256(source).hexdigest(),assets=assets,capabilities=derive(rows,catalog),catalog=catalog,template_bytes=len(template.encode('utf8')))
if __name__=='__main__':
    result=extract(sys.argv[1]);print(json.dumps(result,indent=2))
