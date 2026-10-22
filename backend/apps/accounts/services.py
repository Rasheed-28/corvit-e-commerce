import logging
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes

logger = logging.getLogger(__name__)


def send_welcome_email(user) -> bool:
    """
    Sends a personalized welcome email upon customer registration.
    Wrapped in fail-safe handling so registration never fails if email delivery is unavailable.
    """
    if not user.email:
        return False

    recipient_name = user.get_full_name() or user.username
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    subject = "Welcome to Our Store! Your Account is Ready"
    message = (
        f"Hello {recipient_name},\n\n"
        f"Thank you for joining our community! Your account has been created successfully.\n\n"
        f"You can now browse our full collection, track your orders, and save your favorite items:\n"
        f"{frontend_url}/products\n\n"
        f"If you have any questions or need assistance, our support team is always here to help.\n\n"
        f"Best regards,\n"
        f"The Customer Experience Team"
    )
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@ecommerce.example.com')

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=[user.email],
            fail_silently=False,
        )
        return True
    except Exception as exc:
        logger.warning(f"Failed to send welcome email to {user.email}: {exc}")
        return False


def send_password_reset_email(user) -> tuple[str, str]:
    """
    Generates a secure password reset token and sends an email to the user.
    Returns (uid, token).
    """
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    reset_link = f"{frontend_url}/reset-password?uid={uid}&token={token}"

    subject = "Password Reset Request - E-Commerce Platform"
    recipient_name = user.get_full_name() or user.username
    message = (
        f"Hello {recipient_name},\n\n"
        f"You recently requested to reset your password for your account.\n"
        f"Please click the link below to set a new password:\n\n"
        f"{reset_link}\n\n"
        f"If you did not request a password reset, please ignore this email.\n"
        f"This link will expire automatically.\n\n"
        f"Best regards,\n"
        f"The Security Team"
    )
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@ecommerce.example.com')

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception as exc:
        logger.warning(f"Failed to send password reset email to {user.email}: {exc}")

    return uid, token

