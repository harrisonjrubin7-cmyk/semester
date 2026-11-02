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
    correction_results: dict = field(default_factory=dict)
    trail: dict = field(default_factory=dict)
    lock: object = field(default_factory=Lock)

    @staticmethod
    def _view(cmd):
        # A waitlisted outcome is a business state; execution stays on the execution track.
        out = copy.deepcopy(cmd)
        if 'business' in cmd:
            out['execution'] = cmd['state']
            out['state'] = cmd['business']
        return out

    def _waitlist_entry(self, k, payload, reason):
        self.waitlist[k] = {'receipt': 'waitlist:' + str(len(self.waitlist) + 1),
                            'payload': copy.deepcopy(payload), 'reason': reason}
        return self.waitlist[k]['receipt']

    def submit(self, actor, tenant, key, payload, context=None, fault=None):
        # This entry point only enrolls. Other commands have their own operations and must not reach this path.
        if payload.get('command', 'enroll') != 'enroll':
            raise ValueError('submit() handles only the enroll command')
        c = dict(context or {})
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        k = (tenant, actor, 'enroll', key)
        with self.lock:
            grants = c.get('grant_tenants')
            if grants is not None and tenant not in grants:
                return {'state': 'denied', 'effects': 0}
            if not c.get('identity_ok', True):
                return {'state': 'denied', 'effects': 0}
            existing = self.commands.get(k)
            if existing and existing['hash'] != digest:
                return {'state': 'conflict', 'effects': 0}
            if existing and not existing.get('confirmed_no_commit'):
                # An authenticated repeat gets the durable outcome, even after a later permission revocation.
                return self._view(existing)
            if not c.get('permission_ok', True):
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
                # The rejected offer is a durable waitlist outcome, so a redelivery cannot turn it into an enrollment.
                cmd = {'state': 'committed', 'hash': digest, 'key': k, 'effects': 1,
                       'projection': 'complete', 'original_payload': copy.deepcopy(payload),
                       'business': 'waitlisted'}
                cmd['receipt'] = self._waitlist_entry(k, payload, 'offer_expired')
                self.commands[k] = cmd
                return self._view(cmd)
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
            # The committed request schema names the field section_ref.
            scope = (tenant, payload.get('section_ref'))
            occupied = sum(1 for kk, rec in self.authoritative.items()
                           if (kk[0], rec['payload'].get('section_ref')) == scope)
            if occupied >= self.capacity:
                # Waitlisting is an authoritative write of a waitlist entry, so it carries its own receipt.
                cmd.update(state='committed', business='waitlisted', projection='complete', effects=1,
                           receipt=self._waitlist_entry(k, payload, 'capacity'))
                return self._view(cmd)
            self.authoritative[k] = {'receipt': 'authority:' + str(len(self.authoritative) + 1),
                                     'payload': copy.deepcopy(payload), 'status': 'enrolled'}
            cmd.update(state='committed', effects=1, business='enrolled',
                       receipt=self.authoritative[k]['receipt'])
            if fault == 'timeout_after':
                # The receipt stays in the authoritative record until reconcile() recovers it.
                cmd.pop('receipt', None)
                cmd.pop('business', None)
                cmd.update(state='result_unknown', effects=0)
            elif fault != 'projection_fail':
                cmd['projection'] = 'complete'
            return self._view(cmd)

    def reconcile(self, key, definitive=True):
        with self.lock:
            cmd = self.commands[key]
            if cmd['state'] != 'result_unknown':
                # Only the declared result_unknown -> reconciling path may move a command.
                return dict(self._view(cmd), rejected='not_result_unknown')
            trail = self.trail.setdefault(key, [])
            if not definitive:
                trail.append('result_unknown')
                return self._view(cmd)
            cmd['state'] = 'reconciling'
            trail.append('reconciling')
            result = self.authoritative.get(key)
            if result:
                cmd.update(state='committed', effects=1, business='enrolled', receipt=result['receipt'])
            else:
                cmd.update(state='failed', effects=0, confirmed_no_commit=True)
            trail.append(cmd['state'])
            return self._view(cmd)

    def repair_projection(self, key):
        with self.lock:
            if key not in self.authoritative:
                raise ValueError('No authoritative commitment to project')
            # Projection repair publishes only a committed execution, never one still awaiting reconciliation.
            if self.commands[key]['state'] != 'committed':
                raise ValueError('Projection repair requires a committed execution')
            self.commands[key]['projection'] = 'complete'
            return self._view(self.commands[key])

    def correct(self, key, approved, correction_key):
        with self.lock:
            # Idempotency belongs to the correction request; the enrollment key is only its target.
            replay = (key, correction_key)
            # A durable correction answers its own retry before approval is revalidated.
            if replay in self.correction_results:
                return copy.deepcopy(self.correction_results[replay])
            if not approved:
                return {'state': 'correction_pending'}
            if key not in self.authoritative:
                raise ValueError('No committed record')
            self.corrections.append({'original': key, 'correction_key': correction_key, 'type': 'authorized_correction'})
            self.authoritative[key]['status'] = 'superseded_by_correction'
            result = {'state': 'corrected', 'correction_receipt': len(self.corrections)}
            self.correction_results[replay] = result
            return copy.deepcopy(result)

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
        # The model owns its clock. Leases are timed against it, never against a caller-supplied value.
        self.now = 0
    def set_time(self, t):
        with self.lock:
            if t < self.now:
                raise ValueError('the model clock cannot move backwards')
            self.now = t
    def claim(self, job, event_id, tenant, ttl=60):
        # A lease names one event, tenant and consumer job, and expires after ttl; the fence is counted per (tenant, job, event).
        with self.lock:
            fence_key = (tenant, job, event_id)
            self.fence[fence_key] = self.fence.get(fence_key, 0) + 1
            return (job, self.fence[fence_key], event_id, tenant, self.now + ttl)
    def apply(self, event_id, token, approved=True, tenant='default', fault=None):
        job, fence, bound_event, bound_tenant, expires_at = token
        with self.lock:
            # A token applies only to the event and tenant it leases, so no other lease can commit the effect.
            if bound_event != event_id:
                return 'wrong_event'
            if bound_tenant != tenant:
                return 'wrong_tenant'
            # The inbox is per tenant, consumer and event, so one consumer's effect cannot mark another's delivery.
            key = (tenant, job, event_id)
            # A consumed event answers with its durable outcome before any expiry, fencing or approval check.
            if key in self.inbox:
                return 'denied' if self.inbox[key] == 'denied' else 'duplicate'
            if self.now >= expires_at:
                return 'lease_expired'
            if fence != self.fence.get((tenant, job, bound_event)):
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
