from dataclasses import dataclass, field
from threading import Lock
import copy
import hashlib
import json

@dataclass
class RegistrationModel:
    capacity: int = 1
    commands: dict = field(default_factory=dict)
    authoritative: dict = field(default_factory=dict)
    waitlist: dict = field(default_factory=dict)
    corrections: list = field(default_factory=list)
    trail: dict = field(default_factory=dict)
    lock: object = field(default_factory=Lock)

    @staticmethod
    def _view(cmd):
        # A waitlisted outcome is a business state; execution stays on the execution track.
        out = dict(cmd)
        if 'business' in cmd:
            out['execution'] = cmd['state']
            out['state'] = cmd['business']
        return out

    def submit(self, actor, tenant, key, payload, context=None, fault=None):
        c = dict(context or {})
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        k = (tenant, actor, 'enroll', key)
        with self.lock:
            existing = self.commands.get(k)
            if existing and existing['hash'] != digest:
                return {'state': 'conflict', 'effects': 0}
            if existing and not existing.get('confirmed_no_commit'):
                # A durable outcome answers a repeat before any current authorization check.
                return self._view(existing)
            grants = c.get('grant_tenants')
            if grants is not None and tenant not in grants:
                return {'state': 'denied', 'effects': 0}
            if not c.get('identity_ok', True) or not c.get('permission_ok', True):
                return {'state': 'denied', 'effects': 0}
            if not c.get('authority_ok', True):
                return {'state': 'paused', 'effects': 0}
            if not c.get('fresh', True):
                return {'state': 'awaiting_information', 'effects': 0}
            # Authority proved no commit: a same-key retry re-enters the checks above.
            if not c.get('window_open', True) or not c.get('ticket_open', True):
                return {'state': 'denied', 'effects': 0}
            if c.get('hold', False):
                return {'state': 'awaiting_information', 'effects': 0}
            if c.get('override_expired', False):
                return {'state': 'awaiting_approval', 'effects': 0}
            if not c.get('eligible', True) and not c.get('scoped_override', False):
                return {'state': 'awaiting_approval', 'effects': 0}
            if c.get('offer_expired', False):
                return {'state': 'waitlisted', 'effects': 0}
            if fault == 'precommit':
                # Persist the payload binding so a same-key retry cannot change the payload.
                cmd = {'state': 'failed', 'hash': digest, 'key': k, 'effects': 0,
                       'projection': 'pending', 'original_payload': copy.deepcopy(payload),
                       'confirmed_no_commit': True}
                self.commands[k] = cmd
                return self._view(cmd)
            cmd = {'state': 'running', 'hash': digest, 'key': k, 'effects': 0,
                   'projection': 'pending', 'original_payload': copy.deepcopy(payload)}
            self.commands[k] = cmd
            if fault == 'timeout_before':
                cmd.update(state='result_unknown')
                return self._view(cmd)
            scope = (tenant, payload.get('section'))
            occupied = sum(1 for kk, rec in self.authoritative.items()
                           if (kk[0], rec['payload'].get('section')) == scope)
            if occupied >= self.capacity:
                # Waitlisting is an authoritative write of a waitlist entry, so it carries its own receipt.
                self.waitlist[k] = {'receipt': 'waitlist:' + str(len(self.waitlist) + 1),
                                    'payload': copy.deepcopy(payload)}
                cmd.update(state='committed', business='waitlisted', receipt=self.waitlist[k]['receipt'])
                return self._view(cmd)
            self.authoritative[k] = {'receipt': 'authority:' + str(len(self.authoritative) + 1),
                                     'payload': copy.deepcopy(payload), 'status': 'enrolled'}
            cmd.update(state='committed', effects=1,
                       receipt=self.authoritative[k]['receipt'])
            if fault == 'timeout_after':
                # The receipt stays in the authoritative record until reconcile() recovers it.
                cmd.pop('receipt', None)
                cmd.update(state='result_unknown', effects=0)
            elif fault != 'projection_fail':
                cmd['projection'] = 'complete'
            return self._view(cmd)

    def reconcile(self, key, definitive=True):
        with self.lock:
            cmd = self.commands[key]
            if cmd['state'] != 'result_unknown':
                # Only the declared result_unknown -> reconciling path may move a command.
                return dict(cmd, rejected='not_result_unknown')
            trail = self.trail.setdefault(key, [])
            if not definitive:
                trail.append('result_unknown')
                return dict(cmd)
            cmd['state'] = 'reconciling'
            trail.append('reconciling')
            result = self.authoritative.get(key)
            if result:
                cmd.update(state='committed', effects=1, receipt=result['receipt'])
            else:
                cmd.update(state='failed', effects=0, confirmed_no_commit=True)
            trail.append(cmd['state'])
            return dict(cmd)

    def repair_projection(self, key):
        with self.lock:
            if key not in self.authoritative:
                raise ValueError('No authoritative commitment to project')
            self.commands[key]['projection'] = 'complete'
            return dict(self.commands[key])

    def correct(self, key, approved):
        with self.lock:
            if not approved:
                return {'state': 'correction_pending'}
            if key not in self.authoritative:
                raise ValueError('No committed record')
            self.corrections.append({'original': key, 'type': 'authorized_correction'})
            self.authoritative[key]['status'] = 'superseded_by_correction'
            return {'state': 'corrected', 'correction_receipt': len(self.corrections)}

    def swap(self, original, replacement_available):
        if not replacement_available:
            return {'state': 'failed', 'original': original, 'original_retained': True}
        return {'state': 'committed', 'original': original, 'replacement_confirmed': True}

    def withdrawal(self, financial_ok):
        return {'academic': 'withdrawn', 'financial': 'reconciled' if financial_ok else 'owned_exception'}

class WorkerReferenceModel:
    def __init__(self):
        self.fence = {}
        self.inbox = {}
        self.effects = 0
        self.receipts = []
        self.lock = Lock()
    def claim(self, job='default'):
        with self.lock:
            self.fence[job] = self.fence.get(job, 0) + 1
            return (job, self.fence[job])
    def apply(self, event_id, token, approved=True, tenant='default', fault=None):
        job, fence = token
        key = (tenant, event_id)
        with self.lock:
            # A consumed event answers with its durable outcome before any fencing or approval check.
            if key in self.inbox:
                return 'denied' if self.inbox[key] == 'denied' else 'duplicate'
            if fence != self.fence.get(job):
                return 'stale_lease'
            if not approved:
                self.inbox[key] = 'denied'
                return 'denied'
            # Effect, receipt and inbox marker commit together or not at all.
            effects_before, receipts_before = self.effects, len(self.receipts)
            try:
                self.effects += 1
                self.receipts.append({'kind': 'committed', 'event': event_id, 'tenant': tenant})
                if fault == 'crash_before_marker':
                    raise RuntimeError('worker crashed before the inbox marker')
                self.inbox[key] = 'committed'
            except RuntimeError:
                self.effects = effects_before
                del self.receipts[receipts_before:]
                raise
            return 'committed'
