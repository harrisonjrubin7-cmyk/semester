from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

from app.schemas import GuideContent


class UnsupportedCitationError(ValueError):
    pass


def validate_citation_ids(requested: Iterable[UUID | str], allowed: set[UUID | str]) -> None:
    normalized_allowed = {str(value) for value in allowed}
    unknown = {str(value) for value in requested} - normalized_allowed
    if unknown:
        raise UnsupportedCitationError(f"Unknown citations: {', '.join(sorted(unknown))}")


def validate_guide(guide: GuideContent, allowed: set[UUID | str]) -> None:
    if not guide.sections:
        raise UnsupportedCitationError("Guide has no cited sections")
    for section in guide.sections:
        validate_citation_ids(section.citation_ids, allowed)


def deduplicate_flashcards(cards: list[dict]) -> list[dict]:
    seen: set[str] = set()
    result = []
    for card in cards:
        fingerprint = " ".join(card["front"].casefold().split())
        if fingerprint not in seen:
            seen.add(fingerprint)
            result.append(card)
    return result
