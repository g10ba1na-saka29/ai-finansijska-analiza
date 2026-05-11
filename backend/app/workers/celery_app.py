from celery import Celery
from app.config import settings

celery_app = Celery(
    "fin_analiza",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.tasks.pdf_processing",
        "app.workers.tasks.kpi_calculation",
        "app.workers.tasks.report_generation",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Sarajevo",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=86400,  # 24h
    broker_connection_retry_on_startup=True,
)
