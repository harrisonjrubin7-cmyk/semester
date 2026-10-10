from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol


@dataclass
class ExtractedChunk:
    content: str
    content_type: str = "paragraph"
    page_number: int | None = None
    slide_number: int | None = None
    sheet_name: str | None = None
    cell_range: str | None = None
    start_seconds: float | None = None
    end_seconds: float | None = None
    confidence: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class Extractor(Protocol):
    def extract(self, path: Path) -> list[ExtractedChunk]: ...
