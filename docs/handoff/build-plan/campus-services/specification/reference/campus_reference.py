"""Pure reference calculations; not production allocation or financial authority."""
from datetime import timedelta

def periods_overlap(a_start, a_end, b_start, b_end):
    if not a_start < a_end or not b_start < b_end:
        raise ValueError("invalid period")
    return a_start < b_end and b_start < a_end

def standard_title_iv_deadline(created, classes_start):
    """Only standard date arithmetic after qualified classification; no hold/R2T4 logic."""
    return max(created, classes_start) + timedelta(days=14)

def hold_cancellation_deadline(received):
    return received + timedelta(days=14)

def rollover_preview(granted, consumed, reserved, cap, eligible):
    values=(granted,consumed,reserved,cap)
    if any(type(x) is not int or x<0 for x in values):
        raise ValueError("nonnegative integer units required")
    if consumed+reserved>granted:
        raise ValueError("overdrawn lot")
    available=granted-consumed-reserved
    transfer=min(available,cap) if eligible is True else 0
    return {"transfer":transfer,"untransferred_available":available-transfer,
            "reserved_pending":reserved,"requires_reserved_resolution":reserved>0}

def roommate_similarity(a,b,weights):
    total=0;score=0;details=[]
    for field,w in weights.items():
        if w<0:raise ValueError("negative weight")
        if field not in a or field not in b or a[field] is None or b[field] is None:
            continue
        if w==0:continue
        match=a[field]==b[field]
        total+=w;score+=w*int(match);details.append({"field":field,"match":match})
    return {"score":score/total if total else None,"compared_fields":details}
