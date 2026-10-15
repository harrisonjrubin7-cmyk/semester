#!/usr/bin/env python3
"""A sizing MODEL for 10-physical-design.md. Every input below is an ASSUMPTION, not a measurement:
no workload exists yet, and the migrated schema has no rows. The point is to show which tables cross a
partitioning threshold first and how sensitive the answer is to the one input that matters most
(per-student blob size). Replace the inputs with the pilot's measured values and re-run.

    python3 appendix/sizing_model.py
"""
SCENARIOS = {            # name: (tenants, students)
    'Pilot (1 tenant)':    (1,        2_000),
    'Early (10 tenants)':  (10,     150_000),
    'Scale (200 tenants)': (200,  3_000_000),
}
OVERHEAD = 2.2           # heap + indexes + MVCC slack multiplier on raw row bytes (assumed)
THRESH_ROWS, THRESH_GB = 50e6, 50      # rule-of-thumb triggers to *consider* partitioning (see 10 section 4)
# name: (rows per student per day OR None, rows per student (stock) OR None, row bytes, retention days OR None, note)
FLOWS = {
 'audit_event':              (0.3,  None, 350, 3*365, 'denials, privileged reads, grants; 3-year clock'),
 'access_log (90 d)':        (1.0,  None, 150, 90,    'who read your rows; pruned on write'),
 'activity (400 d)':         (3.0,  None,  60, 400,   'at most 3 marks per account per day'),
 'domain_outbox_events':     (8.0,  None, 400, 90,    'envelope after 30-day scrub; operational class'),
 'gateway/AI audit (180 d)': (0.5,  None, 300, 180,   'metadata only'),
 'ai.retrieval_log (180 d)': (0.2,  None, 200, 180,   'metadata only'),
}
STOCKS = {
 'student blobs (tasks, notes, courses, state, ...)': (None, 300, 1500, None, '300 rows x 1.5 KB per student: THE input to measure'),
 'grade_entries':            (None,  80,  250, None, '2 terms x 40 entries; institution record, school retention'),
 'student_account_entries':  (None,  20,  200, None, 'ledger; hash-chained; never deleted'),
}
def gb(rows, b): return rows * b * OVERHEAD / 1e9
print(f'{"table (assumption)":52s}', *[f'{n:>26s}' for n in SCENARIOS])
for name, (rate, stock, rb, ret, note) in {**FLOWS, **STOCKS}.items():
    cells = []
    for _, (t, s) in SCENARIOS.items():
        rows = rate * s * ret if rate else stock * s
        flag = '  <-- consider partitioning' if (rows >= THRESH_ROWS or gb(rows, rb) >= THRESH_GB) and rate else ''
        cells.append(f'{rows/1e6:8.1f}M rows {gb(rows, rb):8.1f} GB{flag}')
    print(f'{name:52s}', *[f'{c:>26s}' if not c.endswith('partitioning') else c for c in cells])
print()
print('Derived stores (per tenant, ASSUMED 20,000 shared documents, 5 chunks each, 2 KB text, 1024-dim float4 embedding):')
for n, (t, s) in SCENARIOS.items():
    docs = 20_000 * t; chunks = docs * 5
    text = chunks * 2_000 * OVERHEAD / 1e9; emb = chunks * 4_096 / 1e9; hnsw = emb * 1.5
    print(f'  {n:22s} documents {docs/1e6:6.2f}M  chunks {chunks/1e6:6.2f}M  text {text:7.1f} GB  embeddings {emb:7.1f} GB  HNSW ~{hnsw:7.1f} GB')
print()
print('Sensitivity of the student-blob estimate to bytes per student (Scale scenario):')
for kb in (50, 150, 450, 1500):
    print(f'  {kb:5d} KB/student -> {kb*1e3*3_000_000/1e12:6.2f} TB raw, {kb*1e3*3_000_000*OVERHEAD/1e12:6.2f} TB with overhead')
