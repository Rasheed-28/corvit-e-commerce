import uuid
from django.db import models

class UUIDModel(models.Model):
    """
    Abstract base model that replaces the default auto-increment integer ID with a UUID4.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedModel(models.Model):
    """
    Abstract base model that provides self-updating created_at and updated_at fields.
    """
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class TimeStampedUUIDModel(UUIDModel, TimeStampedModel):
    """
    Combined abstract model providing both UUID primary key and timestamp tracking.
    """
    class Meta:
        abstract = True
