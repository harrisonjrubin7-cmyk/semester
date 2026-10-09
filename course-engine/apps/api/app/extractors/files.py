from __future__ import annotations

import csv
import zipfile
from pathlib import Path

import pymupdf as fitz
from docx import Document
from openpyxl import load_workbook
from pptx import Presentation

from app.extractors.base import ExtractedChunk
from app.services.storage import ALLOWED_EXTENSIONS


def extract_pdf(path: Path) -> list[ExtractedChunk]:
    chunks = []
    with fitz.open(path) as document:
        for index, page in enumerate(document, 1):
            text = page.get_text("text").strip()
            confidence = 1.0 if text else 0.0
            chunks.append(ExtractedChunk(text or "[OCR required]", "page", page_number=index, confidence=confidence))
    return chunks


def extract_docx(path: Path) -> list[ExtractedChunk]:
    doc = Document(path)
    chunks = [ExtractedChunk(p.text, "paragraph") for p in doc.paragraphs if p.text.strip()]
    for table_index, table in enumerate(doc.tables, 1):
        text = "\n".join(" | ".join(cell.text for cell in row.cells) for row in table.rows)
        chunks.append(ExtractedChunk(text, "table", metadata={"table": table_index}))
    return chunks


def extract_pptx(path: Path) -> list[ExtractedChunk]:
    deck = Presentation(path)
    chunks = []
    for number, slide in enumerate(deck.slides, 1):
        text = "\n".join(shape.text for shape in slide.shapes if hasattr(shape, "text") and shape.text.strip())
        notes = slide.notes_slide.notes_text_frame.text if slide.has_notes_slide else ""
        chunks.append(ExtractedChunk("\n".join(filter(None, [text, notes])), "slide", slide_number=number))
    return chunks


def extract_xlsx(path: Path) -> list[ExtractedChunk]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    chunks = []
    for sheet in workbook.worksheets:
        rows = list(sheet.iter_rows(values_only=True))
        if not rows:
            continue
        text = "\n".join(" | ".join("" if v is None else str(v) for v in row) for row in rows)
        chunks.append(ExtractedChunk(text, "table", sheet_name=sheet.title, cell_range=sheet.calculate_dimension()))
    return chunks


def extract_text(path: Path) -> list[ExtractedChunk]:
    return [ExtractedChunk(path.read_text(encoding="utf-8", errors="replace"), "document")]


def extract_csv(path: Path) -> list[ExtractedChunk]:
    with path.open(newline="", encoding="utf-8-sig", errors="replace") as handle:
        rows = list(csv.reader(handle))
    width = max((len(r) for r in rows), default=1)
    return [ExtractedChunk("\n".join(" | ".join(r) for r in rows), "table", sheet_name="CSV", cell_range=f"A1:{chr(64+min(width,26))}{len(rows)}")]


def safe_zip_members(path: Path, output_dir: Path) -> list[Path]:
    output_dir = output_dir.resolve()
    results = []
    with zipfile.ZipFile(path) as archive:
        total = 0
        for info in archive.infolist():
            total += info.file_size
            if total > 500 * 1024 * 1024 or info.file_size > 100 * 1024 * 1024:
                raise ValueError("Archive exceeds safe extraction limits")
            target = (output_dir / info.filename).resolve()
            if output_dir not in target.parents or info.is_dir():
                if info.is_dir():
                    continue
                raise ValueError("Unsafe archive path")
            if target.suffix.lower() not in ALLOWED_EXTENSIONS or target.suffix.lower() == ".zip":
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info) as source, target.open("wb") as destination:
                while block := source.read(1024 * 1024):
                    destination.write(block)
            results.append(target)
    return results


def extractor_for(path: Path):
    return {
        ".pdf": extract_pdf, ".docx": extract_docx, ".pptx": extract_pptx,
        ".xlsx": extract_xlsx, ".csv": extract_csv, ".txt": extract_text, ".md": extract_text,
    }.get(path.suffix.lower())
