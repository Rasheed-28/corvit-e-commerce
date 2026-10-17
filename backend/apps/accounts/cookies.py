from django.conf import settings

def set_jwt_cookies(response, access_token, refresh_token=None):
    """
    Sets secure HttpOnly cookies for JWT access and refresh tokens.
    """
    access_max_age = getattr(settings, 'AUTH_COOKIE_ACCESS_MAX_AGE', 1800)
    secure = getattr(settings, 'AUTH_COOKIE_SECURE', not settings.DEBUG)
    samesite = getattr(settings, 'AUTH_COOKIE_SAMESITE', 'Lax')
    domain = getattr(settings, 'AUTH_COOKIE_DOMAIN', None)
    path = getattr(settings, 'AUTH_COOKIE_PATH', '/')

    response.set_cookie(
        key=getattr(settings, 'AUTH_COOKIE_ACCESS_NAME', 'access_token'),
        value=str(access_token),
        max_age=access_max_age,
        expires=access_max_age,
        secure=secure,
        httponly=getattr(settings, 'AUTH_COOKIE_HTTPONLY', True),
        samesite=samesite,
        path=path,
        domain=domain,
    )

    if refresh_token:
        refresh_max_age = getattr(settings, 'AUTH_COOKIE_REFRESH_MAX_AGE', 604800)
        response.set_cookie(
            key=getattr(settings, 'AUTH_COOKIE_REFRESH_NAME', 'refresh_token'),
            value=str(refresh_token),
            max_age=refresh_max_age,
            expires=refresh_max_age,
            secure=secure,
            httponly=getattr(settings, 'AUTH_COOKIE_HTTPONLY', True),
            samesite=samesite,
            path=path,
            domain=domain,
        )


def clear_jwt_cookies(response):
    """
    Clears the JWT access and refresh cookies by setting expiration in the past.
    """
    samesite = getattr(settings, 'AUTH_COOKIE_SAMESITE', 'Lax')
    domain = getattr(settings, 'AUTH_COOKIE_DOMAIN', None)
    path = getattr(settings, 'AUTH_COOKIE_PATH', '/')

    response.delete_cookie(
        key=getattr(settings, 'AUTH_COOKIE_ACCESS_NAME', 'access_token'),
        path=path,
        domain=domain,
        samesite=samesite,
    )
    response.delete_cookie(
        key=getattr(settings, 'AUTH_COOKIE_REFRESH_NAME', 'refresh_token'),
        path=path,
        domain=domain,
        samesite=samesite,
    )
