from __future__ import annotations

import re
from datetime import datetime

EXPLICIT_TIME = re.compile(r"\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b", re.IGNORECASE)


def parse_explicit_date(value: str, default_year: int | None = None) -> dict:
    """Parse only stated components; never supplies a time or a missing year silently."""
    cleaned = value.strip()
    year_match = re.search(r"\b(20\d{2})\b", cleaned)
    year = int(year_match.group(1)) if year_match else default_year
    formats = ["%B %d %Y", "%b %d %Y", "%m/%d/%Y", "%Y-%m-%d"]
    normalized = re.sub(r"(\d)(st|nd|rd|th)", r"\1", cleaned, flags=re.IGNORECASE)
    date_value = None
    if year is not None:
        candidate = normalized if year_match else f"{normalized} {year}"
        candidate = candidate.replace(",", "")
        candidate = EXPLICIT_TIME.sub("", candidate).strip(" ,")
        for fmt in formats:
            try:
                date_value = datetime.strptime(candidate, fmt).date(); break
            except ValueError:
                continue
    time_match = EXPLICIT_TIME.search(cleaned)
    explicit_time = time_match.group(0) if time_match else None
    return {
        "date": date_value.isoformat() if date_value else None,
        "time": explicit_time,
        "year_unspecified": year_match is None,
        "time_unspecified": time_match is None,
        "status": "confirmed" if date_value and year_match else "needs_review",
    }
