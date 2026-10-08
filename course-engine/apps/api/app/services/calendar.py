from __future__ import annotations

from icalendar import Calendar, Event


def build_ics(course_title: str, events: list[object]) -> bytes:
    calendar = Calendar()
    calendar.add("prodid", "-//Course Engine//semester//EN")
    calendar.add("version", "2.0")
    for item in events:
        if getattr(item, "status", None).value != "confirmed":
            continue
        event = Event()
        event.add("uid", f"{item.id}@course-engine")
        event.add("summary", f"{course_title}: {item.title}")
        if item.start_at:
            event.add("dtstart", item.start_at)
            if item.end_at:
                event.add("dtend", item.end_at)
        elif item.event_date:
            event.add("dtstart", item.event_date)
        event.add("description", "Source-linked event exported by Course Engine")
        calendar.add_component(event)
    return calendar.to_ical()
