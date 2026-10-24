import os
from django.core.exceptions import ImproperlyConfigured
from .base import *

DEBUG = False

# Strict production host matching
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('ALLOWED_HOSTS', '').split(',') if h.strip()]
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("ALLOWED_HOSTS environment variable must be configured in production.")

# Secret Key validation
if not os.environ.get('DJANGO_SECRET_KEY') or SECRET_KEY == 'django-insecure-dev-fallback-key-replace-in-prod':
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set to a secure, unique value in production.")

# Production PostgreSQL Database
# Supports either a unified DATABASE_URL (standard on PaaS like Render, Railway, Heroku)
# or individual DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT variables.
if os.environ.get('DATABASE_URL'):
    from urllib.parse import urlparse, unquote
    db_url = urlparse(os.environ['DATABASE_URL'])
    DB_NAME = db_url.path.lstrip('/')
    DB_USER = unquote(db_url.username or '')
    DB_PASSWORD = unquote(db_url.password or '')
    DB_HOST = db_url.hostname or ''
    DB_PORT = str(db_url.port or '5432')
else:
    DB_NAME = os.environ.get('DB_NAME')
    DB_USER = os.environ.get('DB_USER')
    DB_PASSWORD = os.environ.get('DB_PASSWORD')
    DB_HOST = os.environ.get('DB_HOST')
    DB_PORT = os.environ.get('DB_PORT', '5432')

if not all([DB_NAME, DB_USER, DB_PASSWORD, DB_HOST]):
    raise ImproperlyConfigured(
        "Production environment strictly requires PostgreSQL. Configure either DATABASE_URL or DB_NAME, DB_USER, DB_PASSWORD, and DB_HOST."
    )

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': DB_NAME,
        'USER': DB_USER,
        'PASSWORD': DB_PASSWORD,
        'HOST': DB_HOST,
        'PORT': DB_PORT,
        'CONN_MAX_AGE': int(os.environ.get('DB_CONN_MAX_AGE', '600')),
        'OPTIONS': {
            'sslmode': os.environ.get('DB_SSLMODE', 'require'),
            'connect_timeout': int(os.environ.get('DB_CONNECT_TIMEOUT', '10')),
        },
    }
}

# Production Security Headers & Cookies
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'True').lower() in ('true', '1', 'yes')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
AUTH_COOKIE_SECURE = True
AUTH_COOKIE_HTTPONLY = True
AUTH_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = 'Lax'
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', '31536000'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# CORS & CSRF
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [h.strip() for h in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',') if h.strip()]
CSRF_TRUSTED_ORIGINS = [h.strip() for h in os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',') if h.strip()]

# Production Static Files Storage with WhiteNoise
STORAGES = {
    'default': {
        'BACKEND': os.environ.get(
            'DEFAULT_FILE_STORAGE',
            'django.core.files.storage.FileSystemStorage'
        ),
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

# Media asset configuration (persistent disk or object storage)
if os.environ.get('MEDIA_ROOT'):
    MEDIA_ROOT = Path(os.environ['MEDIA_ROOT'])
if os.environ.get('MEDIA_URL'):
    MEDIA_URL = os.environ['MEDIA_URL']

# Allow explicit media serving in production if using persistent disk on single-container PaaS
SERVE_MEDIA_FILES = os.environ.get('SERVE_MEDIA_FILES', 'False').lower() in ('true', '1', 'yes')

