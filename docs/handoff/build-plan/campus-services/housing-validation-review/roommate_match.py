from math import isfinite
FEATURES=("lifestyle","noise","sleep")
def segments(start,end):
 if type(start) is not int or type(end) is not int or not(0<=start<1440 and 0<=end<1440) or start==end:raise ValueError("invalid sleep window")
 return [(start,end)] if start<end else [(start,1440),(0,end)]
def sleep_overlap(a,b):
 sa,sb=segments(*a),segments(*b)
 overlap=sum(max(0,min(y,v)-max(x,u)) for x,y in sa for u,v in sb)
 return overlap/max(sum(y-x for x,y in sa),sum(y-x for x,y in sb))
def level(value):
 if type(value) is not int or not 0<=value<=4:raise ValueError("invalid level")
 return value
def match(a,b,weights,eligible=True,blocked=False):
 if not eligible or blocked or a.get("opt_in") is not True or b.get("opt_in") is not True:return {"status":"excluded","score":None,"coverage":0,"factors":{}}
 if set(weights)!=set(FEATURES) or any(type(w) not in(int,float) or not isfinite(w) or w<0 for w in weights.values()):raise ValueError("invalid weights")
 total=sum(weights.values())
 if total==0:return {"status":"no_weights","score":None,"coverage":0,"factors":{}}
 factors={}
 for f in FEATURES:
  if weights[f]==0 or f not in a.get("shared",[]) or f not in b.get("shared",[]):continue
  if f=="lifestyle":
   values=[1-abs(level(a[k])-level(b[k]))/4 for k in ("cleanliness","social_activity") if a.get(k) is not None and b.get(k) is not None]
   if values:factors[f]=sum(values)/len(values)
  elif f=="noise":
   values=[a.get("noise_output"),a.get("noise_tolerance"),b.get("noise_output"),b.get("noise_tolerance")]
   if all(x is not None for x in values):
    ao,at,bo,bt=map(level,values);factors[f]=1-(max(0,bo-at)+max(0,ao-bt))/8
  elif a.get("sleep") is not None and b.get("sleep") is not None:factors[f]=sleep_overlap(a['sleep'],b['sleep'])
 compared=sum(weights[f] for f in factors)
 if not compared:return {"status":"insufficient_data","score":None,"coverage":0,"factors":{}}
 return {"status":"recommendation_only","score":round(100*sum(weights[f]*v for f,v in factors.items())/compared,2),"coverage":round(compared/total,4),"factors":{f:round(v,4) for f,v in factors.items()}}
