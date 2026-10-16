import pymupdf as fitz

from app.extractors.files import extract_pdf, normalized_pdf_bounds


def test_pdf_extraction_records_normalized_text_block_bounds(tmp_path):
    path = tmp_path / "bounded.pdf"
    with fitz.open() as document:
        page = document.new_page(width=600, height=800)
        page.insert_text((60, 80), "Bounded source evidence")
        document.save(path)

    chunks = extract_pdf(path)

    assert len(chunks) == 1
    assert chunks[0].content == "Bounded source evidence"
    assert chunks[0].content_type == "page_block"
    assert chunks[0].page_number == 1
    assert chunks[0].confidence == 1.0
    assert chunks[0].bounding_box is not None
    assert chunks[0].bounding_box["coordinate_space"] == "normalized"
    for key in ("x", "y", "width", "height"):
        assert 0 <= chunks[0].bounding_box[key] <= 1


def test_pdf_extraction_marks_pages_without_text_for_ocr(tmp_path):
    path = tmp_path / "image-only.pdf"
    with fitz.open() as document:
        document.new_page(width=600, height=800)
        document.save(path)

    chunks = extract_pdf(path)

    assert len(chunks) == 1
    assert chunks[0].content == "[OCR required]"
    assert chunks[0].bounding_box is None
    assert chunks[0].confidence == 0.0


def test_pdf_extraction_transforms_bounds_for_rotated_page(tmp_path):
    path = tmp_path / "rotated.pdf"
    with fitz.open() as document:
        page = document.new_page(width=600, height=800)
        page.insert_text((60, 80), "Rotated source evidence")
        page.set_rotation(90)
        document.save(path)

    bounds = extract_pdf(path)[0].bounding_box

    assert bounds is not None
    assert bounds["x"] > 0.8
    assert bounds["y"] < 0.2


def test_pdf_bounds_skip_degenerate_pages():
    class DegeneratePage:
        rect = fitz.Rect(0, 0, 0, 0)
        rotation = 0

    assert normalized_pdf_bounds(DegeneratePage(), (0, 0, 0, 0)) is None
