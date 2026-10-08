# 02 Source inventory and extraction

Stages: **inventory** and **classification** (Center), plus extraction, which
the Center has no stage for and which is where most migrations are quietly
decided.

## 1. Source inventory

One sheet per retiring system, filled in with the institution's data steward
before anything is extracted. It is the first evidence entry
(`inventory`).

| Field | Why it matters |
| --- | --- |
| System, vendor, version, hosting | Export formats and quirks are version-specific; the Center records platform and version (`source_platform`, `source_version`) |
| Data owner (a person) | The Center refuses to leave inventory without one; also the exception owner of last resort |
| Kinds of data held | Which [workbooks](workbooks/README.md) apply (`bridge.ts` `SYSTEM_HOLDS` gives a starting point; `other` is mapped by hand) |
| Entities, with their **natural key** | A display name is not a key. The key decides every join and every duplicate |
| Volume and growth | Sizes the rehearsal and the cutover window |
| History depth and the cutoff | "How far back" is a decision with a name on it (Center `historical_cutoff`) |
| Interfaces that read or write the system | Everything downstream that breaks on cutover: SSO, payments, LMS roster feeds, reporting |
| Custom fields, local codes, free-text conventions | Where meaning hides. Each local code needs a code-table row ([03](03-MAPPING-CLEANSING-TRANSFORMATION.md)) |
| Known data problems | The steward knows them; the queue starts there, not at first run |
| Who may read what in the source | The baseline for the permission checks. Not inferred from the target |

**Inventory is not done** while any entity lacks a natural key, any interface
is unlisted, or "who may read what" is unrecorded.

## 2. Extraction

### Principles

- **Read-only, from a quiesced or snapshot source.** Extraction never writes
  to the legacy system. A consistent snapshot is taken at a stated instant; the
  instant is recorded.
- **Extract the past, not a view of it.** History tables, change logs and audit
  trails are extracted with their original timestamps and actors. A report that
  shows "current" values is not an extract.
- **Extract the permissions.** Role tables, group memberships, sharing and
  release records, in the same snapshot as the data they govern.
- **Files by content.** Documents and attachments are extracted byte-for-byte
  and identified by SHA-256, not by filename or path. Nothing re-encodes,
  OCRs, compresses or "improves" a file in transit.
- **Full and delta.** A full extract for each rehearsal; a delta mechanism
  (by change timestamp or log position) for the days between, so cutover moves
  a small, rehearsed delta rather than everything.
- **Deletions are data.** An extract that omits records deleted since the last
  one makes a deleted student reappear. Extraction carries tombstones.

### Extract manifest

Each extract writes a manifest, and its digest goes in the ledger
(`extract_manifest`):

```
system, version, snapshot_instant (with zone), extractor version,
entity → { row_count, key_count, min/max source timestamp, file digest },
tombstones included: yes/no, history included: yes/no, permissions included: yes/no
```

The manifest holds counts and digests, never rows. The Center's sample SHA-256
is the same idea at file scale.

### Where extracts live

Extracts are student records. They sit in the institution's or Semester's
controlled storage under the data-processing terms agreed by counsel, with
access logged, encryption at rest, and a deletion date. They are not copied to
laptops, shared drives or chat. Rehearsal extracts are deleted on a stated
date; the manifest and digests are what is retained as evidence. What
retention applies to extracts is a records-schedule question
([06 §5](06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)).

## 3. Source-system freeze and the delta

Between the final full extract and cutover the legacy system keeps running.
Agree in advance:

- the **freeze** instant after which the source takes no writes (or only
  writes queued for replay);
- the **delta extract** that captures changes since the full one;
- who may write during the window, and what happens to a write that arrives
  late (it is queued and applied after cutover, or refused with a message).

## 4. Classification

Per entity: sensitivity (`internal`, `confidential`, `restricted` in the
workbooks; the Center's four classifications `public` … `restricted`),
retention owner, and whether **counsel** must decide before the entity moves.
Entities that always need that decision before extraction: guardian consent and
custody notes, accommodation and counselling-adjacent records, conduct
records, anything with a legal hold, and third-party content with licence
terms. The workbook traps name them. This pack does not decide them.

## 5. Exit criteria for inventory, classification and extraction

- [ ] Inventory sheet complete, signed by the data owner
- [ ] Every entity has a natural key and a history decision
- [ ] "Who may read what" captured from the source
- [ ] Classification and counsel flags recorded; counsel questions logged
- [ ] First extract manifest in the ledger; digests recorded
- [ ] Extract storage, access and deletion date agreed
- [ ] Freeze and delta approach written down
