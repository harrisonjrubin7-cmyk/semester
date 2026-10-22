import json, html, re
esc = lambda s: html.escape(str(s))
def scalar(v): return not isinstance(v, (dict, list))
def label(k): 
    k = re.sub(r'([a-z])([A-Z])', r'\1 \2', str(k)).replace('_', ' ')
    return k[:1].upper() + k[1:]
def inline(v, depth=0):
    if scalar(v): return esc(v) if v is not None else ''
    if isinstance(v, list):
        if all(scalar(x) for x in v): return esc(', '.join(str(x) for x in v))
        return '<ul>' + ''.join('<li>' + inline(x, depth+1) + '</li>' for x in v) + '</ul>'
    return '<div class="kv">' + ''.join(f'<div><b>{esc(label(k))}:</b> {inline(x, depth+1)}</div>' for k, x in v.items()) + '</div>'
def render(v, depth=2, title=None):
    out = ''
    h = min(depth, 4)
    if title is not None: out += f'<h{h}>{esc(label(title))}</h{h}>'
    if isinstance(v, list) and v and all(isinstance(x, dict) for x in v):
        cols = []
        for x in v:
            for k in x:
                if k not in cols: cols.append(k)
        def short(x): return scalar(x) and len(str(x)) < 70
        simple = all(short(x.get(c, '')) or (isinstance(x.get(c), list) and all(scalar(y) for y in x.get(c)) and len(str(x.get(c))) < 90) for x in v for c in cols)
        if len(cols) <= 4 or (len(cols) <= 7 and simple):
            out += '<table class="dt"><thead><tr>' + ''.join(f'<th>{esc(label(c))}</th>' for c in cols) + '</tr></thead><tbody>'
            for x in v: out += '<tr>' + ''.join(f'<td>{inline(x.get(c, ""))}</td>' for c in cols) + '</tr>'
            return out + '</tbody></table>'
        for x in v:
            name = next((x[k] for k in ('name','title','label','id','role','key') if k in x and scalar(x[k])), None)
            out += '<div class="rec">' + (f'<div class="rt">{esc(name)}</div>' if name else '') + inline({k: y for k, y in x.items()}) + '</div>'
        return out
    if isinstance(v, dict):
        if all(scalar(x) or (isinstance(x, list) and all(scalar(y) for y in x)) for x in v.values()):
            return out + '<table class="dt kvt"><tbody>' + ''.join(f'<tr><th>{esc(label(k))}</th><td>{inline(x)}</td></tr>' for k, x in v.items()) + '</tbody></table>'
        for k, x in v.items(): out += render(x, depth+1, k)
        return out
    return out + f'<div>{inline(v)}</div>'
