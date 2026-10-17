import os
from .base import *

DEBUG = True

# Database: Uses PostgreSQL if configured via env vars; falls back cleanly to local SQLite for rapid dev
DB_ENGINE = os.environ.get('DB_ENGINE', '')

if DB_ENGINE == 'django.db.backends.postgresql':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME', 'ecommerce_db'),
            'USER': os.environ.get('DB_USER', 'ecommerce_user'),
            'PASSWORD': os.environ.get('DB_PASSWORD', 'ecommerce_secret_password'),
            'HOST': os.environ.get('DB_HOST', 'localhost'),
            'PORT': os.environ.get('DB_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# CORS & CSRF Settings for Local Development
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]

CSRF_TRUSTED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]

# Development Email Backend
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
