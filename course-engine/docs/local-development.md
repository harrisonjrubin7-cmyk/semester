# Local development

Copy `.env.example` to `.env`; change `JWT_SECRET` outside disposable local work. Start Compose from the repository root. PostgreSQL runs internally, MinIO is available on ports 9000/9001, the API on 8000, and Next.js on 3000.

Use `scripts/seed_demo_course.py` inside the API environment. It creates a user, course, preserved sample source, citation, all-day time-unspecified assignment, and source-linked guide. It never fabricates benchmark numbers.

The benchmark creates a difficult 100-section fixture and runs WeasyPrint, ReportLab, and python-docx in fresh subprocesses. Output includes CSV, raw JSON, summary JSON, and artifacts under `benchmark/output/`.
