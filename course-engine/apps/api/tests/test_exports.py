from pathlib import Path

from app.services.exports import export_flashcards_pdf, export_guide_docx, export_guide_pdf


def test_export_logic(tmp_path: Path):
    content = {"sections": [{"heading": "Evidence", "explanation": "Supported text", "key_points": ["One"], "citation_ids": ["c1"]}]}
    citations = {"c1": {"label": "Syllabus.pdf, p. 1"}}
    try:
        pdf = export_guide_pdf("Guide", content, citations, tmp_path / "guide.pdf")
    except OSError:
        pdf = None  # Docker image supplies Pango; this host may not.
    if pdf is not None:
        assert pdf.stat().st_size > 0
    assert export_guide_docx("Guide", content, citations, tmp_path / "guide.docx").stat().st_size > 0
    cards = [{"id": "card-1", "front": "Question?", "back": "Answer.", "difficulty": 2, "source_label": "Reading.pdf, p. 2"}]
    assert export_flashcards_pdf(cards, tmp_path / "cards.pdf").stat().st_size > 0
