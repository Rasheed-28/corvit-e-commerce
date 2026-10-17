import os
import sys
from .base import *

DEBUG = True

# Read database settings from environment variables
# Primary supported driver: psycopg (v3) via django.db.backends.postgresql
DB_ENGINE = os.environ.get('DB_ENGINE', '').strip()
USE_SQLITE_FALLBACK = os.environ.get('USE_SQLITE_FALLBACK', 'False').lower() in ('true', '1', 'yes')

if DB_ENGINE == 'django.db.backends.sqlite3' or USE_SQLITE_FALLBACK:
    # Explicit SQLite development fallback (never silently activated)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
    if 'test' not in sys.argv:
        print("[Database Notice] Active Engine: SQLite development fallback (db.sqlite3).")
else:
    # Intended PostgreSQL configuration
    DB_NAME = os.environ.get('DB_NAME', 'ecommerce_db')
    DB_USER = os.environ.get('DB_USER', 'ecommerce_user')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_PORT = os.environ.get('DB_PORT', '5432')
    DB_CONN_MAX_AGE = int(os.environ.get('DB_CONN_MAX_AGE', '0'))
    DB_SSLMODE = os.environ.get('DB_SSLMODE', 'prefer')

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': DB_NAME,
            'USER': DB_USER,
            'PASSWORD': DB_PASSWORD,
            'HOST': DB_HOST,
            'PORT': DB_PORT,
            'CONN_MAX_AGE': DB_CONN_MAX_AGE,
            'OPTIONS': {
                'sslmode': DB_SSLMODE,
                'connect_timeout': int(os.environ.get('DB_CONNECT_TIMEOUT', '3')),
            },
        }
    }
    if 'test' not in sys.argv:
        print(f"[Database Notice] Active Engine: PostgreSQL (host={DB_HOST}:{DB_PORT}, db={DB_NAME}, user={DB_USER}).")

# Development Email Backend
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

