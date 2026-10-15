"""Offline evidence consistency checker; not production authorization.
Use authenticated evidence and existing Semester governance in production.
"""
from dataclasses import dataclass
from datetime import datetime

@dataclass(frozen=True)
class Target:
    sha: str
    deployment: str
    config: str
    schema: str
    scope: str
    operation: str

@dataclass(frozen=True)
class Evidence:
    gate: str
    target: Target
    passed: bool
    accepted: bool
    issued_at: datetime
    expires_at: datetime
    evidence_ref: str
    approver: str
    withdrawn: bool = False

def evaluate(target, required, records, now, killed=False):
    reasons = []
    if killed:
        reasons.append("kill_switch")
    if not isinstance(target, Target) or not all(vars(target).values()):
        reasons.append("unresolved_target")
    if not required or len(set(required)) != len(required):
        reasons.append("invalid_gate_contract")
    for gate in required:
        matches = [r for r in records if r.gate == gate and r.target == target]
        if len(matches) != 1:
            reasons.append(gate + ":missing_or_ambiguous")
            continue
        r = matches[0]
        try:
            current = r.issued_at <= now < r.expires_at
        except TypeError:
            current = False
        if (not r.passed or not r.accepted or r.withdrawn or not current
                or not r.evidence_ref or not r.approver):
            reasons.append(gate + ":invalid")
    return {"allowed": not reasons, "reasons": reasons}
