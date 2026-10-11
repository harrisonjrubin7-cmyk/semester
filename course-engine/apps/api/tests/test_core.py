from datetime import date
from uuid import uuid4

import pytest

from app.api.routes import _citation_label
from app.models.entities import SourceChunk, SourceDocument
from app.schemas import GuideContent, ReviewPatch
from app.services.citations import (
    UnsupportedCitationError,
    canonicalize_study_asset_citations,
    deduplicate_flashcards,
    validate_guide,
    validate_study_asset_content,
)
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


def test_flashcard_source_labels_are_derived_from_authoritative_citations():
    citation_id = uuid4()
    content = {
        "cards": [{
            "id": str(uuid4()),
            "front": "When is the exam?",
            "back": "December 10",
            "difficulty": 3,
            "citation_ids": [str(citation_id)],
            "source_label": "Fabricated source label",
        }],
        "citations": {str(citation_id): {"label": "Also fabricated", "quote": "Wrong"}},
    }
    catalog = {
        str(citation_id): {"label": "Syllabus.pdf, p. 1", "quote": "Final exam: December 10."}
    }

    canonical = canonicalize_study_asset_citations("flashcards", content, catalog)

    assert canonical["citations"] == catalog
    assert canonical["cards"][0]["source_label"] == "Syllabus.pdf, p. 1"
    assert content["cards"][0]["source_label"] == "Fabricated source label"


def test_archive_member_is_included_in_authoritative_citation_label():
    document = SourceDocument(
        course_id=uuid4(),
        filename="week-one.zip",
        storage_key="private/originals/week-one.zip",
        mime_type="application/zip",
        size_bytes=100,
        sha256="a" * 64,
    )
    chunk = SourceChunk(
        document_id=uuid4(),
        chunk_index=0,
        content="Lecture text",
        page_number=2,
        metadata_json={"archive_member": "slides/lecture.pdf"},
    )

    assert _citation_label(document, chunk) == "week-one.zip › slides/lecture.pdf, p. 2"


def test_assignment_title_normalization():
    assert normalize_title("Essay One") == normalize_title("Essay #1")


def test_review_correction_payload_is_bounded():
    with pytest.raises(ValueError, match="256 KB"):
        ReviewPatch(status="confirmed", corrected_payload={"content": "x" * 256_001})


def test_study_asset_approval_rejects_empty_or_unknown_citations():
    allowed = {uuid4()}
    with pytest.raises(UnsupportedCitationError, match="no cited sections"):
        validate_study_asset_content("comprehensive_guide", {"sections": []}, allowed)
    with pytest.raises(UnsupportedCitationError, match="Unknown citations"):
        validate_study_asset_content(
            "flashcards",
            {"cards": [{
                "id": uuid4(),
                "front": "Question",
                "back": "Answer",
                "difficulty": 3,
                "citation_ids": [uuid4()],
            }]},
            allowed,
        )
    with pytest.raises(UnsupportedCitationError, match="invalid"):
        validate_study_asset_content(
            "comprehensive_guide",
            {"sections": [{"citation_ids": list(allowed)}]},
            allowed,
        )
