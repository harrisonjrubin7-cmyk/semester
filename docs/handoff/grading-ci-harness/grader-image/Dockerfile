# Reviewed grader image. Build, push, then pin the pushed digest — never a tag.
#   docker build -t ghcr.io/<org>/semester-grader:py312 grader-image
#   docker push ghcr.io/<org>/semester-grader:py312
#   docker buildx imagetools inspect ghcr.io/<org>/semester-grader:py312 --format '{{json .Manifest.Digest}}'
#   → set repo variable GRADER_IMAGE=ghcr.io/<org>/semester-grader@sha256:<digest>
# Base pinned by digest: resolve with  docker buildx imagetools inspect python:3.12-slim  and paste it below.
ARG PYTHON_BASE=python:3.12-slim@sha256:REPLACE_WITH_REVIEWED_DIGEST
FROM ${PYTHON_BASE}
# Standard library only; no pip, no network at runtime, no shell for the learner user.
RUN rm -rf /usr/local/lib/python3.12/ensurepip /usr/local/lib/python3.12/site-packages/pip* \
 && useradd --uid 65534 --no-create-home --shell /usr/sbin/nologin grader 2>/dev/null || true
USER 65534:65534
WORKDIR /tmp
