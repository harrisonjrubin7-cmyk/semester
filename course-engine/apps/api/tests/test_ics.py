from datetime import date
from types import SimpleNamespace
from uuid import uuid4

from app.models.entities import ReviewStatus
from app.services.calendar import build_ics


def test_ics_only_exports_confirmed_events_and_preserves_all_day_date():
    confirmed = SimpleNamespace(id=uuid4(), title="Midterm", status=ReviewStatus.confirmed, start_at=None, end_at=None, event_date=date(2026, 10, 15))
    uncertain = SimpleNamespace(id=uuid4(), title="Maybe quiz", status=ReviewStatus.needs_review, start_at=None, end_at=None, event_date=date(2026, 10, 16))
    payload = build_ics("Course", [confirmed, uncertain]).decode()
    assert "Midterm" in payload
    assert "Maybe quiz" not in payload
    assert "DTSTART;VALUE=DATE:20261015" in payload
