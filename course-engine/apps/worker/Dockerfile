FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libmagic1 ffmpeg tesseract-ocr && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY apps/api ./
RUN pip install --no-cache-dir .
COPY apps/worker /app/worker
CMD ["celery", "-A", "worker.tasks.celery", "worker", "--loglevel=INFO"]
