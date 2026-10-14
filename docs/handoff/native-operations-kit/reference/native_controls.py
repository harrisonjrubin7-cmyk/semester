"""Local reference invariants only; not deployed DB, payment or agent runtime."""
from dataclasses import dataclass
from collections import Counter
import hashlib, json

CHECK_IDS = tuple(f"C{i:02}" for i in range(1,15))

def evaluate_checks(checks):
    denied = [key for key in CHECK_IDS if checks.get(key) is not True]
    return {"allowed": not denied, "denied": denied}

@dataclass(frozen=True)
class Line:
    account: str
    debit: int = 0
    credit: int = 0
    currency: str = "USD"

def validate_journal(lines):
    if len(lines) < 2:
        raise ValueError("two or more lines required")
    balances = Counter()
    for line in lines:
        if not line.account or type(line.debit) is not int or type(line.credit) is not int:
            raise ValueError("account and integer minor units required")
        if line.debit < 0 or line.credit < 0 or (line.debit > 0) == (line.credit > 0):
            raise ValueError("one positive side per line")
        if not line.currency:
            raise ValueError("currency required")
        balances[line.currency] += line.debit - line.credit
    if any(value != 0 for value in balances.values()):
        raise ValueError("unbalanced per currency")
    return True

class ObserveTask:
    def __init__(self, task_id, root_agent, routes):
        self.task_id = task_id
        self.routes = frozenset(routes)
        self.nodes = {root_agent: (0, ())}
        self.keys = set()
        self.handoffs = 0

    def handoff(self, source, destination, purpose, digest, authorized=False):
        if not authorized:
            raise ValueError("receiver authorization required")
        if source not in self.nodes or (source,destination) not in self.routes:
            raise ValueError("unregistered or forbidden route")
        key = (self.task_id,source,destination,purpose,digest)
        if key in self.keys:
            return "deduplicated"
        depth, ancestors = self.nodes[source]
        if destination == source or destination in ancestors or destination in self.nodes:
            raise ValueError("cycle or ambiguous existing recipient")
        if depth + 1 > 3 or self.handoffs >= 3:
            raise ValueError("depth or total handoff budget exceeded")
        self.nodes[destination] = (depth+1,ancestors+(source,))
        self.keys.add(key)
        self.handoffs += 1
        return "accepted"

    def execute_external_write(self):
        raise PermissionError("observe mode cannot execute external writes")

def action_digest(payload):
    return hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(",",":"),allow_nan=False).encode()).hexdigest()
