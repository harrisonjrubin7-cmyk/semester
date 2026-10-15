"""Synthetic roommate recommendation reference; never assignment authority."""
from math import isfinite

FEATURES = ("lifestyle", "noise", "sleep")

def segments(start, end):
    if type(start) is not int or type(end) is not int:
        raise ValueError("minutes must be integers")
    if not (0 <= start < 1440 and 0 <= end < 1440) or start == end:
        raise ValueError("invalid or ambiguous sleep window")
    return [(start,end)] if start < end else [(start,1440),(0,end)]

def sleep_overlap(a,b):
    sa,sb=segments(*a),segments(*b)
    overlap=sum(max(0,min(y,v)-max(x,u)) for x,y in sa for u,v in sb)
    duration=lambda s:sum(y-x for x,y in s)
    return overlap/max(duration(sa),duration(sb))

def level(value):
    if type(value) is not int or not 0 <= value <= 4:
        raise ValueError("level must be integer 0..4")
    return value

def match(a,b,weights,eligible=True,blocked=False):
    if not eligible or blocked or a.get("opt_in") is not True or b.get("opt_in") is not True:
        return {"status":"excluded","score":None,"coverage":0,"factors":{}}
    if set(weights) != set(FEATURES):
        raise ValueError("exactly lifestyle/noise/sleep weights required")
    if any(type(w) not in (int,float) or not isfinite(w) or w<0 for w in weights.values()):
        raise ValueError("finite nonnegative weights required")
    total=sum(weights.values())
    if total == 0:
        return {"status":"no_weights","score":None,"coverage":0,"factors":{}}
    factors={}
    for feature in FEATURES:
        if weights[feature] == 0 or feature not in a.get("shared",[]) or feature not in b.get("shared",[]):
            continue
        if feature == "lifestyle":
            values=[]
            for field in ("cleanliness","social_activity"):
                x,y=a.get(field),b.get(field)
                if x is not None and y is not None:
                    values.append(1-abs(level(x)-level(y))/4)
            if values: factors[feature]=sum(values)/len(values)
        elif feature == "noise":
            av=[a.get("noise_output"),a.get("noise_tolerance")]
            bv=[b.get("noise_output"),b.get("noise_tolerance")]
            if all(x is not None for x in av+bv):
                ao,at,bo,bt=map(level,av+bv)
                excess=max(0,bo-at)+max(0,ao-bt)
                factors[feature]=1-excess/8
        else:
            av,bv=a.get("sleep"),b.get("sleep")
            if av is not None and bv is not None:
                factors[feature]=sleep_overlap(av,bv)
    compared=sum(weights[f] for f in factors)
    if not compared:
        return {"status":"insufficient_data","score":None,"coverage":0,"factors":{}}
    return {"status":"recommendation_only",
            "score":round(100*sum(weights[f]*v for f,v in factors.items())/compared,2),
            "coverage":round(compared/total,4),
            "factors":{f:round(v,4) for f,v in factors.items()}}
