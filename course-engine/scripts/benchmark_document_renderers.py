from __future__ import annotations

import argparse
import csv
import json
import statistics
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "benchmark/output"
FIXTURE = ROOT / "benchmark/fixtures/guide_100_pages.json"
WORKER = ROOT / "benchmark/renderers/render.py"


def median_metric(rows: list[dict[str, object]], key: str) -> float:
    if not rows:
        return 0
    return round(statistics.median(float(row[key]) for row in rows), 2)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=1)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    if not FIXTURE.exists():
        subprocess.run(
            [sys.executable, str(FIXTURE.with_name("generate_fixture.py"))],
            check=True,
        )

    rows: list[dict[str, object]] = []
    for renderer, extension in [
        ("weasyprint", "pdf"),
        ("reportlab", "pdf"),
        ("python-docx", "docx"),
    ]:
        for run in range(1, args.runs + 1):
            output = OUT / f"{renderer}-100-page-{run}.{extension}"
            metrics = OUT / f"{renderer}-{run}.json"
            completed = subprocess.run(
                [
                    sys.executable,
                    str(WORKER),
                    renderer,
                    str(FIXTURE),
                    str(output),
                    str(metrics),
                ],
                capture_output=True,
                text=True,
                timeout=300,
                check=False,
            )
            payload = (
                json.loads(metrics.read_text(encoding="utf-8"))
                if metrics.exists()
                else {"success": False, "error": completed.stderr[-1000:]}
            )
            rows.append({"renderer": renderer, "run_number": run, **payload})

    summary: list[dict[str, object]] = []
    for renderer in {str(row["renderer"]) for row in rows}:
        successful = [
            row
            for row in rows
            if row["renderer"] == renderer and row.get("success")
        ]

        summary.append(
            {
                "renderer": renderer,
                "successful_runs": len(successful),
                "success_rate": round(len(successful) / args.runs * 100, 1),
                "median_render_ms": median_metric(successful, "elapsed_ms"),
                "median_peak_rss_mb": median_metric(successful, "peak_rss_mb"),
                "median_peak_python_mb": median_metric(successful, "peak_python_mb"),
                "median_output_bytes": median_metric(successful, "output_bytes"),
                "median_page_count": median_metric(successful, "page_count"),
            }
        )

    (OUT / "benchmark_runs.json").write_text(
        json.dumps(rows, indent=2),
        encoding="utf-8",
    )
    (OUT / "benchmark_summary.json").write_text(
        json.dumps(summary, indent=2),
        encoding="utf-8",
    )
    with (OUT / "benchmark_runs.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(
        json.dumps(
            {"generated_at": datetime.now(UTC).isoformat(), "summary": summary},
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
