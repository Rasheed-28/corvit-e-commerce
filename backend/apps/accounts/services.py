from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes

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

    send_mail(
        subject=subject,
        message=message,
        from_email=from_email,
        recipient_list=[user.email],
        fail_silently=False,
    )

    return uid, token
