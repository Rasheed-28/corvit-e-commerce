# NovaStore E-Commerce Platform

A production-grade, modular full-stack e-commerce web platform built with **React 18 (Vite + Tailwind CSS)** and **Django 5.1 REST Framework (PostgreSQL / SQLite fallback)**.

---

## Table of Contents

- [Overview & Architecture](#overview--architecture)
- [Project Directory Structure](#project-directory-structure)
- [Local Development Setup (Windows PowerShell)](#local-development-setup-windows-powershell)
  - [Prerequisites](#prerequisites)
  - [Backend Setup (Django REST Framework)](#backend-setup-django-rest-framework)
  - [Frontend Setup (React + Vite)](#frontend-setup-react--vite)
- [Interactive API Documentation & Endpoints](#interactive-api-documentation--endpoints)
- [Pre-Seeded Demo Accounts](#pre-seeded-demo-accounts)
- [Test Suites & Quality Assurance](#test-suites--quality-assurance)
- [Environment Variables Configuration](#environment-variables-configuration)
  - [Backend Environment Variables (`backend/.env`)](#backend-environment-variables-backendenv)
  - [Frontend Environment Variables (`frontend/.env`)](#frontend-environment-variables-frontendenv)
- [Production Deployment](#production-deployment)
- [Troubleshooting Guidance](#troubleshooting-guidance)

---

## Overview & Architecture

NovaStore provides a complete end-to-end commerce experience designed around domain-driven Django REST Framework micro-apps and a reactive Single-Page Application (SPA):

* **Catalog & Merchandising:** Categories, products, multi-attribute variants, real-time inventory counts, customer reviews, and ratings.
* **Customer Authentication & Profiles:** Cookie-based JWT authentication (`access_token`, `refresh_token`), CSRF protection, and saved address books.
* **Shopping Cart & Wishlist:** Anonymous guest session cart persistence, server-side stock and purchase-limit validation, and automatic cart merging upon customer login.
* **Checkout & Order Management:** Server-side financial calculations (subtotal, taxes, shipping, coupon discount validation), idempotency keys, order status state machine, cancellation with stock restoration.
* **Enterprise Payment Gateway:** Adapter architecture supporting `simulated` mode for zero-cost local testing and `stripe` (PaymentIntents API with HMAC-SHA256 webhook signature validation).
* **Administrative Operations:** Modern administrative dashboard with sales telemetry, revenue reporting, inventory alerts, review moderation, customer directories, and promotional coupon management.

---

## Project Directory Structure

```text
├── backend/                      # Django REST Framework Backend API
│   ├── apps/                     # Modular domain applications
│   │   ├── accounts/             # Authentication, customer profiles, address books
│   │   ├── administration/       # Admin metrics, inventory telemetry, review moderation
│   │   ├── cart/                 # Guest/authenticated carts, items, session merging
│   │   ├── catalog/              # Categories, products, variants, inventory, reviews
│   │   │   └── management/       # seed_catalog management command
│   │   ├── common/               # Shared models, pagination, error envelopes, health check
│   │   ├── orders/               # Orders, line items, address snapshots, timeline
│   │   └── payments/             # Payment adapters (Simulated & Stripe), webhooks, logger
│   ├── config/                   # Django settings, root URLs, WSGI, ASGI
│   │   └── settings/
│   │       ├── base.py           # Base configuration (apps, middleware, JWT, throttling)
│   │       ├── development.py    # Dev settings with SQLite fallback switch
│   │       └── production.py     # Hardened prod settings (Postgres, WhiteNoise, HSTS, SSL)
│   ├── media/                    # Local product images and customer avatars
│   ├── manage.py                 # Django command-line utility
│   ├── requirements.txt          # Production dependencies (Django, DRF, Gunicorn, WhiteNoise, Stripe)
│   ├── requirements-dev.txt      # Development & testing tooling
│   └── .env.example              # Environment variables template
│
├── frontend/                     # React 18 Single-Page Application (Vite)
│   ├── src/
│   │   ├── api/                  # Axios API clients (auth, catalog, cart, orders, admin)
│   │   ├── components/           # Reusable UI components (buttons, modals, drawers, cards)
│   │   ├── contexts/             # AuthContext, CartContext, WishlistContext, NotificationContext
│   │   ├── hooks/                # Custom React hooks (useAuth)
│   │   ├── layouts/              # RootLayout (storefront) and AdminLayout (dashboard)
│   │   ├── pages/                # Storefront view pages & Admin sub-pages
│   │   ├── routes/               # AppRoutes registry (storefront & admin routes)
│   │   └── styles/               # Tailwind CSS entrypoint
│   ├── tests/                    # Integration and E2E test suites (Node test runner)
│   ├── package.json              # NPM scripts and dependencies
│   ├── vite.config.js            # Vite configuration with /api reverse proxy
│   └── .env.example              # Frontend environment template
│
├── docs/                         # Architecture, API specifications, and deployment runbooks
│   ├── architecture_overview.md
│   ├── authentication_api_contracts.md
│   ├── catalogue_api_contracts.md
│   ├── database_setup_guide.md
│   ├── deployment_guide.md       # Comprehensive production deployment runbook
│   └── payment_integration_architecture.md
│
├── render.yaml                   # Infrastructure-as-Code Blueprint for Render deployment
└── README.md                     # This project guide
```

---

## Local Development Setup (Windows PowerShell)

### Prerequisites

* **Python:** Version 3.12+ (Python 3.15 tested)
* **Node.js:** Version 18.x+ (Node 24 tested)
* **Git for Windows**
* **PostgreSQL (Optional for local dev):** If PostgreSQL is not installed locally, NovaStore provides an automatic, explicit SQLite fallback.

---

### Backend Setup (Django REST Framework)

Open Windows PowerShell and navigate to the project directory:

```powershell
# 1. Navigate to backend directory
cd backend

# 2. Create Python virtual environment
python -m venv venv

# 3. Activate virtual environment
# NOTE: If PowerShell reports script execution is disabled, run:
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
# (Alternative for Command Prompt CMD: .\venv\Scripts\activate.bat)

# 4. Install backend dependencies
pip install -r requirements.txt

# 5. Create environment configuration
Copy-Item .env.example .env

# 6. Apply database migrations
python manage.py migrate

# 7. Seed initial catalog, inventory, and demo accounts
python manage.py seed_catalog

# 8. Start Django development server
python manage.py runserver 127.0.0.1:8000
```

The Django REST API will be running at `http://127.0.0.1:8000/`.

---

### Frontend Setup (React + Vite)

Open a **second** Windows PowerShell terminal:

```powershell
# 1. Navigate to frontend directory
cd frontend

# 2. Create frontend environment configuration
Copy-Item .env.example .env

# 3. Install frontend dependencies
# NOTE: Using npm.cmd ensures compatibility even if PowerShell script execution is restricted
npm.cmd install

# 4. Start Vite development server
npm.cmd run dev
```

The React storefront will open at `http://localhost:5173/`.  
All API requests to `/api` and `/media` are automatically proxied by Vite to the backend on `http://127.0.0.1:8000`.

---

## Interactive API Documentation & Endpoints

When the backend server is running, the following interactive documentation and system endpoints are available:

| Endpoint | Description | Authentication |
| :--- | :--- | :--- |
| **`http://127.0.0.1:8000/api/v1/common/docs/`** | **Swagger UI** interactive API explorer | Public |
| **`http://127.0.0.1:8000/api/v1/common/redoc/`** | **ReDoc** clean OpenAPI specification viewer | Public |
| **`http://127.0.0.1:8000/api/v1/common/schema/`** | Raw OpenAPI JSON schema definition | Public |
| **`http://127.0.0.1:8000/api/v1/common/health/`** | Health check probe (database connectivity status) | Public |
| **`http://127.0.0.1:8000/admin/`** | Django Admin back-office interface | Staff / Superuser |
| **`http://localhost:5173/admin`** | React Administrator Dashboard SPA | Admin User |

---

## Pre-Seeded Demo Accounts

Running `python manage.py seed_catalog` provisions the following development accounts:

| Role | Username / Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `AdminPass2026!` | Superuser / Full Dashboard Access |
| **Customer** | `alex.reynolds@example.com` | `NovaStore2026!` | Customer Storefront, Saved Addresses |
| **Reviewer 1** | `marcus.vance@example.com` | `NovaStore2026!` | Verified Buyer Reviews |
| **Reviewer 2** | `sophia.lin@example.com` | `NovaStore2026!` | Verified Buyer Reviews |

> [!WARNING]
> These credentials are strictly for local testing. In production environments, never run `seed_catalog`. Instead, create a dedicated administrator using `python manage.py createsuperuser --noinput` as detailed in the deployment guide.

---

## Test Suites & Quality Assurance

NovaStore maintains rigorous test suites across both backend and frontend layers:

### 1. Backend Django Test Suite (191 Tests)

Covers authentication, JWT cookies, catalog queries, stock concurrency, order state transitions, payment adapters, webhooks, and administrative telemetry:

```powershell
# From the backend directory with venv activated:
python manage.py test apps
```

### 2. Frontend Integration & E2E Test Suite (63 Tests)

Covers health endpoints, catalog pagination/filters, customer registration/login, cart persistence, stock limits, order placement, and administrator lifecycle:

```powershell
# From the frontend directory:
npm.cmd test
```

### 3. Frontend Code Quality & Linting

```powershell
# From the frontend directory:
npm.cmd run lint
```

### 4. Frontend Production Build Verification

```powershell
# From the frontend directory:
npm.cmd run build
```

### 5. Production Security Deployment Check

```powershell
# From the backend directory:
$env:DJANGO_SETTINGS_MODULE="config.settings.production"
$env:DJANGO_SECRET_KEY="temporary-secret-key-at-least-50-characters-long-for-check"
$env:ALLOWED_HOSTS="localhost,127.0.0.1"
$env:DATABASE_URL="postgres://user:pass@localhost:5432/db"
python manage.py check --deploy
```

---

## Environment Variables Configuration

### Backend Environment Variables (`backend/.env`)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DJANGO_SETTINGS_MODULE` | `config.settings.development` | Set to `config.settings.production` in production. |
| `DJANGO_SECRET_KEY` | Dev fallback key | Unique cryptographic signing key. Must be 50+ chars in production. |
| `DJANGO_DEBUG` | `True` | Set to `False` in production. |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated list of allowed hostnames. |
| `DATABASE_URL` | *(Empty)* | PostgreSQL connection URI (`postgres://user:pass@host:5432/dbname`). |
| `DB_NAME` | `ecommerce_db` | PostgreSQL database name (if not using `DATABASE_URL`). |
| `DB_USER` | `ecommerce_user` | PostgreSQL database user. |
| `DB_PASSWORD` | *(Empty)* | PostgreSQL database password. |
| `DB_HOST` | `localhost` | PostgreSQL host. |
| `DB_PORT` | `5432` | PostgreSQL port. |
| `USE_SQLITE_FALLBACK` | `False` | Set to `True` for zero-setup local SQLite development. |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Allowed frontend origins for CORS. |
| `CSRF_TRUSTED_ORIGINS` | `http://localhost:5173` | Trusted origins for CSRF POST/PUT/DELETE requests. |
| `FRONTEND_URL` | `http://localhost:5173` | Base frontend URL for transactional emails. |
| `MEDIA_ROOT` | `backend/media` | Target filesystem directory for uploaded media. |
| `SERVE_MEDIA_FILES` | `False` | Set to `True` to allow Django to serve media from disk. |
| `PAYMENT_GATEWAY` | `simulated` | Set to `stripe` once Stripe API keys are provisioned. |
| `SIMULATED_WEBHOOK_SECRET`| *(Random secret)* | HMAC secret for simulated webhook testing. |
| `STRIPE_SECRET_KEY` | *(Empty)* | Stripe secret key (`sk_live_...` or `sk_test_...`). |
| `STRIPE_PUBLISHABLE_KEY` | *(Empty)* | Stripe publishable key (`pk_live_...` or `pk_test_...`). |
| `STRIPE_WEBHOOK_SECRET` | *(Empty)* | Stripe webhook signing secret (`whsec_...`). |
| `EMAIL_BACKEND` | `console.EmailBackend` | Set to `smtp.EmailBackend` in production. |
| `EMAIL_HOST` | `localhost` | SMTP host (e.g. `smtp.sendgrid.net`). |
| `EMAIL_PORT` | `587` | SMTP port. |
| `EMAIL_HOST_USER` | *(Empty)* | SMTP account username / API user. |
| `EMAIL_HOST_PASSWORD` | *(Empty)* | SMTP account password / API key. |

### Frontend Environment Variables (`frontend/.env`)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `/api/v1` | Base URL for API requests. In production cross-domain, set to `https://api.yourdomain.com/api/v1`. |
| `VITE_APP_TITLE` | `NovaStore E-Commerce` | Storefront HTML page title. |

---

## Production Deployment

NovaStore is pre-configured for automated one-click deployment using **Render** via the included [`render.yaml`](file:///c:/Users/AR-Dev/Desktop/Web%20Projects/E-Commerce/render.yaml) blueprint:

1. Push your repository to GitHub or GitLab.
2. In the [Render Dashboard](https://dashboard.render.com/), select **New** -> **Blueprint**.
3. Connect your repository. Render automatically reads `render.yaml` and provisions:
   * **Managed PostgreSQL 16** with automated backups.
   * **Django Web Service** with Gunicorn, WhiteNoise static collection, pre-deploy migrations, and a persistent media disk.
   * **React Static Site** with SPA routing rewrites.
4. Set production secrets in the Render dashboard (`STRIPE_SECRET_KEY`, `EMAIL_HOST_PASSWORD`).

For complete, step-by-step documentation on hosting options, S3 object storage, SSL, domain DNS, database backups, and zero-downtime rollbacks, refer to:
[**Comprehensive Production Deployment Guide**](file:///c:/Users/AR-Dev/Desktop/Web%20Projects/E-Commerce/docs/deployment_guide.md).

---

## Troubleshooting Guidance

### 1. PowerShell: "File cannot be loaded because running scripts is disabled on this system"
* **Cause:** Windows PowerShell execution policy restricts `.ps1` script execution by default (`PSSecurityException`).
* **Resolution:**
  * For Node/NPM: Always use `npm.cmd` instead of `npm` (e.g. `npm.cmd install`, `npm.cmd run dev`, `npm.cmd test`).
  * For Python virtualenv: Either run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in your PowerShell session before calling `.\venv\Scripts\Activate.ps1`, or use the Command Prompt batch script: `.\venv\Scripts\activate.bat`.

### 2. Database: "Connection refused" or PostgreSQL not running
* **Cause:** PostgreSQL service is stopped or port 5432 is unavailable.
* **Resolution:**
  * To start the Windows PostgreSQL service: `Start-Service postgresql-x64-*`.
  * For immediate zero-dependency local development without PostgreSQL, edit `backend/.env` and set:
    ```env
    USE_SQLITE_FALLBACK=True
    ```
    Then run `python manage.py migrate` and `python manage.py seed_catalog`.

### 3. CSRF: 403 Forbidden on Mutating Requests (POST / PUT / DELETE)
* **Cause:** The origin of the frontend does not match `CSRF_TRUSTED_ORIGINS`.
* **Resolution:** Ensure `CSRF_TRUSTED_ORIGINS` in `backend/.env` includes your exact frontend protocol, host, and port (e.g. `http://localhost:5173,http://127.0.0.1:5173`).

### 4. Static Files: CSS/Images 404 in Production (`DEBUG=False`)
* **Cause:** Django built-in `runserver` does not serve static files when `DEBUG=False`.
* **Resolution:** NovaStore includes WhiteNoise. Ensure `python manage.py collectstatic --no-input` has been run and `whitenoise.middleware.WhiteNoiseMiddleware` is enabled in `MIDDLEWARE`.

### 5. Payments: "Webhook signature verification rejected"
* **Cause:** Mismatch between the secret used to sign the webhook and `SIMULATED_WEBHOOK_SECRET` / `STRIPE_WEBHOOK_SECRET`.
* **Resolution:** Verify the webhook signing secret in your provider dashboard matches the secret in `backend/.env`. In local development, the simulated gateway automatically handles signatures when using `ordersApi.processPayment()`.
