from datetime import date
from uuid import uuid4

import pytest

from app.schemas import GuideContent, ReviewPatch
from app.services.citations import UnsupportedCitationError, deduplicate_flashcards, validate_guide
from app.services.conflicts import DateFact, find_date_conflicts, normalize_title
from app.services.dates import parse_explicit_date


def test_conflicting_assignment_dates_create_open_review_conflict():
    facts = [
        DateFact("Essay One", date(2026, 10, 15), uuid4()),
        DateFact("Essay #1", date(2026, 10, 18), uuid4()),
    ]
    conflicts = find_date_conflicts(facts)
    assert len(conflicts) == 1
    assert conflicts[0]["status"] == "open"
    assert conflicts[0]["candidate_values"] == ["2026-10-15", "2026-10-18"]


def test_missing_time_is_never_defaulted_to_1159():
    parsed = parse_explicit_date("October 15, 2026")
    assert parsed["date"] == "2026-10-15"
    assert parsed["time"] is None
    assert parsed["time_unspecified"] is True


def test_missing_year_requires_review():
    parsed = parse_explicit_date("October 15")
    assert parsed["date"] is None
    assert parsed["year_unspecified"] is True
    assert parsed["status"] == "needs_review"


def test_generated_guide_section_with_unknown_citation_is_rejected():
    allowed = {uuid4()}
    guide = GuideContent.model_validate({"sections": [{"heading": "Unsupported", "explanation": "Claim", "citation_ids": [uuid4()]}]})
    with pytest.raises(UnsupportedCitationError): validate_guide(guide, allowed)


def test_flashcard_deduplication_normalizes_case_and_spacing():
    cards = [{"front": "What is retrieval?"}, {"front": "  WHAT is  retrieval? "}, {"front": "Why retrieve?"}]
    assert len(deduplicate_flashcards(cards)) == 2


def test_assignment_title_normalization():
    assert normalize_title("Essay One") == normalize_title("Essay #1")


def test_review_correction_payload_is_bounded():
    with pytest.raises(ValueError, match="256 KB"):
        ReviewPatch(status="confirmed", corrected_payload={"content": "x" * 256_001})
