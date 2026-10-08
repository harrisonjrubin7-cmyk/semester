from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from uuid import UUID

NUMBER_WORDS = {"one": "1", "two": "2", "three": "3", "four": "4", "five": "5"}


def normalize_title(value: str) -> str:
    normalized = value.lower()
    for word, number in NUMBER_WORDS.items():
        normalized = re.sub(rf"\b{word}\b", number, normalized)
    return " ".join(re.sub(r"[^a-z0-9\s]", "", normalized).split())


@dataclass(frozen=True)
class DateFact:
    title: str
    value: date
    citation_id: UUID


def find_date_conflicts(facts: list[DateFact]) -> list[dict]:
    grouped: dict[str, list[DateFact]] = defaultdict(list)
    for fact in facts:
        grouped[normalize_title(fact.title)].append(fact)
    conflicts = []
    for title, rows in grouped.items():
        values = sorted({row.value.isoformat() for row in rows})
        if len(values) > 1:
            conflicts.append({
                "normalized_title": title, "candidate_values": values,
                "citation_ids": sorted({str(row.citation_id) for row in rows}), "status": "open",
            })
    return conflicts
