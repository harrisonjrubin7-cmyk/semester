FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libmagic1 libpango-1.0-0 libpangoft2-1.0-0 ffmpeg tesseract-ocr && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY apps/api ./
RUN pip install --no-cache-dir .
COPY scripts /scripts
COPY benchmark /benchmark
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
