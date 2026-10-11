import json
from pathlib import Path

paragraph = ("This section connects an explicit course concept to its stated learning objective, contrasts it with a related idea, and provides a source-grounded application. " * 12)
fixture = {"course_title": "Complex Systems", "title": "100-Page Fixture", "sections": [{"heading": f"Section {i}", "explanation": paragraph, "terms": [[f"Term {i}.{j}", "A cited course definition."] for j in range(8)]} for i in range(1, 101)]}
Path(__file__).with_name("guide_100_pages.json").write_text(json.dumps(fixture), encoding="utf-8")
