from django.conf import settings
from rest_framework import exceptions, permissions
from rest_framework.authentication import CSRFCheck
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed

class CookieJWTAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication that extracts the JWT token from HttpOnly cookies
    or the standard 'Authorization: Bearer <token>' header.

    If the request authenticates via cookie credentials, CSRF protection is strictly
    enforced on mutating HTTP methods (POST, PUT, PATCH, DELETE) to protect against
    cross-site request forgery attacks.
    """

    def authenticate(self, request):
        # 1. If explicit Authorization header is present, use standard JWT header auth
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is not None:
                validated_token = self.get_validated_token(raw_token)
                return self.get_user(validated_token), validated_token

        # 2. Otherwise, check for JWT in HttpOnly cookie
        cookie_name = getattr(settings, 'AUTH_COOKIE_ACCESS_NAME', 'access_token')
        raw_token = request.COOKIES.get(cookie_name)

        if not raw_token:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except (InvalidToken, AuthenticationFailed) as exc:
            raise exceptions.AuthenticationFailed(str(exc))

        user = self.get_user(validated_token)

        # Enforce CSRF validation for mutating methods when authenticated via cookie
        if request.method not in permissions.SAFE_METHODS:
            self.enforce_csrf(request)

        return user, validated_token

    def enforce_csrf(self, request):
        """
        Enforce CSRF validation for cookie-authenticated requests.
        """
        def dummy_get_response(request):
            return None

        check = CSRFCheck(dummy_get_response)
        check.process_request(request)
        # Strictly ensure CSRF evaluation occurs even in testing environments
        dont_enforce = getattr(request, '_dont_enforce_csrf_checks', False)
        request._dont_enforce_csrf_checks = False
        try:
            reason = check.process_view(request, None, (), {})
        finally:
            request._dont_enforce_csrf_checks = dont_enforce

        if reason:
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")
