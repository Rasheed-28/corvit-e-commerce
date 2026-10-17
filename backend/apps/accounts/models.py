from django.db import models
from django.conf import settings
from apps.common.models import TimeStampedUUIDModel

class CustomerProfile(TimeStampedUUIDModel):
    """
    Profile extension for the authenticated user holding customer-specific metadata.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='customer_profile'
    )
    phone_number = models.CharField(max_length=25, blank=True)
    avatar = models.ImageField(upload_to='avatars/%Y/%m/', null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    is_newsletter_subscribed = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Customer Profile'
        verbose_name_plural = 'Customer Profiles'
        ordering = ['-created_at']

    def __str__(self):
        return f"Profile of {self.user.get_username()}"


class Address(TimeStampedUUIDModel):
    """
    Saved shipping and billing physical addresses for customers.
    """
    class AddressType(models.TextChoices):
        SHIPPING = 'SHIPPING', 'Shipping'
        BILLING = 'BILLING', 'Billing'
        BOTH = 'BOTH', 'Both Shipping & Billing'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='addresses'
    )
    address_type = models.CharField(
        max_length=10,
        choices=AddressType.choices,
        default=AddressType.SHIPPING,
        db_index=True
    )
    full_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=25, blank=True)
    street_address_1 = models.CharField(max_length=255)
    street_address_2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, db_index=True)
    state_or_province = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20, db_index=True)
    country = models.CharField(max_length=64, default='US')
    is_default = models.BooleanField(default=False, db_index=True)

    class Meta:
        verbose_name = 'Address'
        verbose_name_plural = 'Addresses'
        ordering = ['-is_default', '-created_at']
        indexes = [
            models.Index(fields=['user', 'is_default']),
            models.Index(fields=['user', 'address_type']),
        ]

    def __str__(self):
        return f"{self.full_name} - {self.street_address_1}, {self.city}"

    def save(self, *args, **kwargs):
        # If this address is set as default, unset any prior default for this user and type
        if self.is_default:
            Address.objects.filter(
                user=self.user,
                address_type=self.address_type,
                is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)
