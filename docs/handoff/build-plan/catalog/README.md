# Stable catalog ids (2026-10-14)

Generated from `ui_kits/master-catalog/catalog-data.js` → `ui_kits/master-catalog/catalog-ids.js` and these CSVs.

| File | Rows | Rule |
|---|---|---|
| screens.csv | 673 entries · **651 canonical** · 22 role variants (`is_variant`, pointing at `canonical_id`) · 84 gap screens · 106 canonical screens with a prototype | `SCR-<group>-<nnn>` by position in its group |
| roles.csv | 49 | `ROLE-<nn>-<SLUG>` |
| workflows.csv | 17 workflows, 319 steps | `WF-<nn>-<SLUG>` |

Ids are immutable once published: never renumber; retire instead (traceability rule). Count canonical screens (651) in any completion metric. These replace name-matching in the catalog reconciliation.

Correction to the reconciliation note: 106 (not 107) canonical screens have a prototype — one prototype link points at a role variant.
