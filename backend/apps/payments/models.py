from django.db import models
from apps.common.models import TimeStampedUUIDModel


class PaymentWebhookEvent(TimeStampedUUIDModel):
    """
    Audit log and idempotency tracking table for incoming payment gateway webhooks.
    Guarantees that a webhook event is never processed multiple times, even under
    high concurrency or multiple delivery retries by the provider.
    """
    class EventStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PROCESSED = 'PROCESSED', 'Processed'
        IGNORED = 'IGNORED', 'Ignored'
        FAILED = 'FAILED', 'Failed'

    provider = models.CharField(max_length=50, db_index=True)
    event_id = models.CharField(max_length=128, db_index=True)
    event_type = models.CharField(max_length=100, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=EventStatus.choices,
        default=EventStatus.PENDING,
        db_index=True
    )
    order_number = models.CharField(max_length=32, blank=True, db_index=True)
    transaction_id = models.CharField(max_length=128, blank=True, db_index=True)
    payload = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Payment Webhook Event'
        verbose_name_plural = 'Payment Webhook Events'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'event_id'],
                name='unique_provider_webhook_event'
            )
        ]
        indexes = [
            models.Index(fields=['provider', 'event_id']),
            models.Index(fields=['order_number']),
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f"{self.provider}:{self.event_type} ({self.event_id}) - {self.status}"
