FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1     PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
COPY requirements.lock ./
RUN python -m pip install --no-cache-dir -r requirements.lock     && python -m pip check     && groupadd --gid 10001 runner     && useradd --uid 10001 --gid runner --no-create-home runner
COPY registrar_schema_checks.py test_registrar_schemas.py ./
USER 10001:10001
CMD ["python", "-m", "unittest", "-v", "test_registrar_schemas.py"]
