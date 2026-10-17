from typing import Any


def validate_task(record: Any) -> bool:
    """Return True only for a valid task; never coerce or mutate input.

    - record must be a dictionary with exactly id, title, status.
    - id/title must be nonempty strings after whitespace checking.
    - status must be exactly open or completed.
    - Invalid inputs, including unknown fields, return False.
    """
    raise NotImplementedError("Implement Week 3 contract validation")
