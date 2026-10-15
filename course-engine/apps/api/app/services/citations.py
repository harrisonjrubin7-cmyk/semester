from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

from pydantic import ValidationError

from app.schemas import Flashcard, GuideContent


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


def validate_study_asset_content(
    asset_type: str,
    content: dict,
    allowed_citation_ids: set[UUID | str],
) -> None:
    if asset_type == "flashcards":
        cards = content.get("cards")
        if not isinstance(cards, list) or not cards:
            raise UnsupportedCitationError("Flashcards have no cited cards")
        try:
            validated_cards = [Flashcard.model_validate(card) for card in cards]
        except ValidationError as exc:
            raise UnsupportedCitationError("Study asset content is invalid") from exc
        for card in validated_cards:
            validate_citation_ids(card.citation_ids, allowed_citation_ids)
        normalized_cards = [card.model_dump(mode="json") for card in validated_cards]
        if len(deduplicate_flashcards(normalized_cards)) != len(validated_cards):
            raise UnsupportedCitationError("Duplicate flashcards are not approvable")
        return

    if not content.get("sections"):
        raise UnsupportedCitationError("Study asset has no cited sections")
    try:
        guide = GuideContent.model_validate(content)
    except ValidationError as exc:
        raise UnsupportedCitationError("Study asset content is invalid") from exc
    validate_guide(guide, allowed_citation_ids)


def canonicalize_study_asset_citations(
    asset_type: str,
    content: dict,
    citation_catalog: dict[str, dict[str, str]],
) -> dict:
    """Return export-safe content whose displayed sources come from stored evidence."""
    canonical = {**content, "citations": citation_catalog}
    if asset_type != "flashcards":
        return canonical

    cards = []
    for card in content.get("cards", []):
        citation_ids = [str(citation_id) for citation_id in card.get("citation_ids", [])]
        try:
            source_label = "; ".join(citation_catalog[citation_id]["label"] for citation_id in citation_ids)
        except KeyError as exc:
            raise UnsupportedCitationError("Study asset citations are no longer approved") from exc
        cards.append({**card, "source_label": source_label})
    return {**canonical, "cards": cards}
