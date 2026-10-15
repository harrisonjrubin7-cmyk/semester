from celery import Celery

from app.core.config import settings

celery_client = Celery("course_engine_client", broker=settings.redis_url, backend=settings.redis_url)
