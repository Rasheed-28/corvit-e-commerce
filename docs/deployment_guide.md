# Production Deployment & Operations Guide

This comprehensive guide details the production deployment, infrastructure provisioning, security hardening, and operational runbooks for the **NovaStore E-Commerce Platform** (Django REST Framework backend + React/Vite SPA frontend + PostgreSQL).

---

## 1. Hosting Options & Infrastructure Architecture

### 1.1 Architectural Overview

The application follows a modern decoupled architecture:
* **Backend:** Python 3.12+ / Django 5.1+ served via **Gunicorn** WSGI HTTP server behind a reverse proxy.
* **Database:** Managed **PostgreSQL 16+** with connection pooling (`CONN_MAX_AGE=600`) and SSL enforcement.
* **Frontend:** React 18 Single-Page Application (SPA) bundled via **Vite**, served as static pre-compiled assets (`dist/`) with client-side HTML5 history routing.
* **Static Assets:** Served directly via **WhiteNoise** with compression and cache-busting unique content hashes.
* **Media Assets:** Stored on an attached persistent disk or an external S3-compatible object storage (Cloudflare R2, AWS S3).

```
                      ┌────────────────────────────────────────┐
                      │          Cloudflare / DNS              │
                      │  (Automated SSL, DDoS, Global CDN)     │
                      └──────────────────┬─────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
       https://yourdomain.com                          https://api.yourdomain.com
                 │                                               │
                 ▼                                               ▼
    ┌─────────────────────────┐                     ┌─────────────────────────┐
    │  Frontend Static Site   │                     │  Backend Web Service    │
    │  (React 18 / Vite SPA)  │                     │  (Gunicorn + Django)    │
    │  Rewrites /* -> index   │                     │  Port $PORT / Healthchk │
    └─────────────────────────┘                     └────────────┬────────────┘
                                                                 │
                                          ┌──────────────────────┴──────────────────────┐
                                          │                                             │
                                          ▼                                             ▼
                             ┌─────────────────────────┐                   ┌─────────────────────────┐
                             │   Managed PostgreSQL    │                   │   Persistent Media      │
                             │   (SSL Mode: require)   │                   │   (/data/media or S3)   │
                             └─────────────────────────┘                   └─────────────────────────┘
```

---

### 1.2 Comparison of Hosting Strategies

| Platform Model | Recommended Providers | Advantages | Disadvantages | Best Suited For |
| :--- | :--- | :--- | :--- | :--- |
| **Unified PaaS (Blueprint)** *(Selected)* | **Render**, Railway | Single-repo orchestration (`render.yaml`), automated TLS, managed Postgres, zero server management, pre-deploy migrations. | Resource limits on entry plans, vendor-specific blueprint schema. | Small-to-medium businesses, rapid production rollout, minimal DevOps overhead. |
| **Decoupled Edge + PaaS** | **Vercel / Netlify** (Frontend) + **Render / Fly.io** (Backend) + **Neon / Supabase** (Postgres) | Best-in-class frontend edge delivery (global CDN), independent scaling of API and UI. | Cross-origin domain management required, multiple vendor billing accounts. | High-traffic global storefronts with dedicated frontend teams. |
| **Containerized IaaS** | **AWS ECS Fargate / DigitalOcean App Platform / Docker Compose on Ubuntu VPS** | Absolute control over infrastructure, custom Nginx caching layers, lowest per-unit compute cost at scale. | High DevOps overhead: manual OS patching, Certbot SSL rotation, VPC security group maintenance. | Enterprise organizations with strict compliance, VPC peering, or dedicated infrastructure teams. |

---

## 2. Selected Platform Blueprint: Render (`render.yaml`)

The repository includes a declarative, current-specification **Render Blueprint** file (`render.yaml`) in the project root. This orchestrates the backend web service, managed PostgreSQL, persistent media volume, and frontend static site in a single deployment.

### 2.1 The Render Blueprint Architecture

* **Database Service (`novastore-postgres`):** Provisions PostgreSQL 16 on a starter plan with automated daily backups and zero-trust IP allowlisting (accessible only internally).
* **Backend Service (`novastore-backend`):**
  * Auto-wires `DATABASE_URL` via `fromDatabase: { name: novastore-postgres, property: connectionString }`.
  * Runs build command: `pip install -r requirements.txt && python manage.py collectstatic --no-input`.
  * Runs pre-deploy command: `python manage.py migrate --no-input` (aborts deployment if database migration fails).
  * Boots Gunicorn: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --timeout 120`.
  * Monitors health at `/api/v1/common/health/`.
  * Mounts a 10 GB persistent disk at `/data/media` for uploaded catalog images and customer avatars.
* **Frontend Service (`novastore-frontend`):**
  * Builds the static bundle: `npm install && npm run build`.
  * Serves `dist/` with SPA routing rules (rewriting `/*` to `/index.html`).
  * Injects immutable cache headers for hashed JavaScript/CSS assets.

---

## 3. PostgreSQL Database Provisioning

### 3.1 Connection String Anatomy

In production, connection details are provided via a standard PostgreSQL URI:
```text
postgresql://novastore_admin:STRONG_PASSWORD_HERE@dpg-xxx-a.oregon-postgres.render.com:5432/novastore_prod?sslmode=require
```

The application's `backend/config/settings/production.py` automatically parses this URI or discrete variables (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`).

### 3.2 Manual Provisioning (External PostgreSQL / Self-Hosted VPS)

If provisioning PostgreSQL outside of Render Blueprint:

```sql
-- 1. Create a dedicated application user with a cryptographically random password
CREATE USER novastore_user WITH PASSWORD 'REPLACE_WITH_STRONG_GENERATED_PASSWORD_64_CHARS';

-- 2. Create the production database with UTF-8 encoding
CREATE DATABASE novastore_prod WITH OWNER novastore_user ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8';

-- 3. Grant schema permissions (PostgreSQL 15+)
\c novastore_prod
GRANT ALL ON SCHEMA public TO novastore_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO novastore_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO novastore_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO novastore_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO novastore_user;
```

### 3.3 Connection Pool & SSL Hardening

In `backend/config/settings/production.py`:
* `CONN_MAX_AGE = 600`: Maintains persistent database connections for up to 10 minutes, eliminating per-request TCP and SSL handshake latency.
* `sslmode = 'require'`: Rejects unencrypted plaintext connections over the wire.
* `connect_timeout = 10`: Fails fast if the database instance is unreachable.

---

## 4. Environment Variables & Secret Management

### 4.1 Production Environment Reference Matrix

Never commit active secrets, credentials, or `.env` files to Git. Configure these variables in the hosting provider's secure environment settings:

| Variable | Required | Default / Example | Purpose & Security Context |
| :--- | :--- | :--- | :--- |
| `DJANGO_SETTINGS_MODULE` | **Yes** | `config.settings.production` | Forces Django into strict production mode (`DEBUG=False`). |
| `DJANGO_SECRET_KEY` | **Yes** | 64+ char random string | Cryptographic signing key for sessions, CSRF, and password resets. |
| `ALLOWED_HOSTS` | **Yes** | `api.yourdomain.com,novastore-backend.onrender.com` | Prevents HTTP Host header poisoning attacks. |
| `DATABASE_URL` | **Yes** | `postgres://user:pass@host:5432/db` | Primary PostgreSQL connection string. |
| `CORS_ALLOWED_ORIGINS` | **Yes** | `https://yourdomain.com,https://www.yourdomain.com` | Whitelist of frontend origins permitted to make cross-origin requests. |
| `CSRF_TRUSTED_ORIGINS` | **Yes** | `https://yourdomain.com,https://api.yourdomain.com` | Whitelist of origins trusted to submit POST/PUT/DELETE requests. |
| `FRONTEND_URL` | **Yes** | `https://yourdomain.com` | Base URL used in password reset and order confirmation emails. |
| `SECURE_SSL_REDIRECT` | Optional | `True` | Automatically redirects HTTP traffic to HTTPS. |
| `STATIC_URL` | Optional | `/static/` | URL prefix for static assets. |
| `MEDIA_URL` | Optional | `/media/` | URL prefix for user-uploaded product media. |
| `MEDIA_ROOT` | Optional | `/data/media` | Absolute filesystem path where uploaded files are persisted. |
| `SERVE_MEDIA_FILES` | Optional | `true` | Allows Django/Gunicorn to serve uploaded media from persistent disk. |
| `PAYMENT_GATEWAY` | Optional | `simulated` or `stripe` | Active payment provider adapter. Default to `simulated` until live keys verified. |
| `SIMULATED_WEBHOOK_SECRET`| Optional | Random secret string | HMAC secret for verifying simulated payment test webhooks. |
| `STRIPE_SECRET_KEY` | Conditional | `sk_live_...` or `sk_test_...` | Stripe API Secret Key. Strictly server-side; never expose to frontend. |
| `STRIPE_PUBLISHABLE_KEY` | Conditional | `pk_live_...` or `pk_test_...` | Stripe Publishable Key. Used for client-side tokenization. |
| `STRIPE_WEBHOOK_SECRET` | Conditional | `whsec_...` | Cryptographic signature secret for Stripe webhooks. |
| `EMAIL_BACKEND` | Optional | `django.core.mail.backends.smtp.EmailBackend` | Production email delivery backend. |
| `EMAIL_HOST` | Conditional | `smtp.sendgrid.net` | SMTP server hostname. |
| `EMAIL_PORT` | Optional | `587` | SMTP port (typically 587 for STARTTLS). |
| `EMAIL_USE_TLS` | Optional | `True` | Enforce STARTTLS encryption for emails. |
| `EMAIL_HOST_USER` | Conditional | `apikey` | SMTP username. |
| `EMAIL_HOST_PASSWORD` | Conditional | `SG.xxxxxxxx...` | SMTP password or API token. |
| `DEFAULT_FROM_EMAIL` | Optional | `NovaStore Orders <orders@yourdomain.com>` | Sender address for transactional emails. |

### 4.2 Generating Cryptographically Secure Secrets

Generate random production keys using Python's standard `secrets` module:

```powershell
# Generate a 64-character DJANGO_SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Generate an HMAC webhook signing secret
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## 5. Production Dependency Installation & Build Pipeline

### 5.1 Backend Build Step

On Linux production environments (Render, Ubuntu VPS, Railway), the build process executes:

```bash
# 1. Upgrade pip
pip install --upgrade pip

# 2. Install production dependencies (including Gunicorn and WhiteNoise)
pip install -r requirements.txt

# 3. Collect static files into STATIC_ROOT (backend/staticfiles)
python manage.py collectstatic --no-input
```

`backend/requirements.txt` includes:
* `Django>=5.1`
* `djangorestframework>=3.15`
* `django-cors-headers>=4.4`
* `djangorestframework-simplejwt>=5.3`
* `psycopg[binary]>=3.2`
* `python-dotenv>=1.0`
* `django-filter>=24.0`
* `inflection>=0.5.1`
* `Pillow>=10.0.0`
* `stripe>=10.0.0`
* `gunicorn>=22.0.0`
* `whitenoise>=6.7.0`

### 5.2 Frontend Build Step

On the static site host:

```bash
# 1. Install dependencies
npm install

# 2. Build production assets
npm run build
```

This compiles React JSX, optimizes Tailwind CSS, and outputs the production bundle to `frontend/dist/`.

---

## 6. Database Migrations & Initial Administrator Creation

### 6.1 Executing Database Migrations

In production, database migrations should run during the **pre-deploy** phase (before the new web process receives traffic):

```bash
python manage.py migrate --no-input
```

If a migration fails, the pre-deploy phase halts, and the existing live service continues running without downtime.

### 6.2 Initial Superuser / Administrator Creation

> [!IMPORTANT]
> Never execute `python manage.py seed_catalog` in production. That command creates demo accounts with known development passwords (`AdminPass2026!`).

Use one of the two secure methods below:

#### Method A: Automated Non-Interactive Superuser (Recommended for CI/CD)

Set the following temporary environment variables in your deployment environment or run a one-off command:
* `DJANGO_SUPERUSER_USERNAME=admin`
* `DJANGO_SUPERUSER_EMAIL=admin@yourdomain.com`
* `DJANGO_SUPERUSER_PASSWORD=SECURE_STRONG_PASSWORD_HERE`

Then execute:
```bash
python manage.py createsuperuser --noinput
```

After execution, delete or unset `DJANGO_SUPERUSER_PASSWORD`.

#### Method B: Interactive Web Shell / SSH

Access the running backend container shell (via Render Dashboard **Shell** tab or SSH) and run:
```bash
python manage.py createsuperuser
```
Follow the interactive prompts to set the username, email, and password.

---

## 7. Static Files & Product Media Storage

### 7.1 Static Files (WhiteNoise)

Static files (Django Admin CSS, REST Framework browsable assets, Swagger UI) are handled by **WhiteNoise**:
1. During build, `python manage.py collectstatic --no-input` compiles all static files into `backend/staticfiles/`.
2. WhiteNoise gzips and brotli-compresses the files and generates MD5-hashed file names (e.g. `base.18f2d9.css`).
3. WhiteNoise middleware intercepts incoming static file requests and serves them directly from Gunicorn with `Cache-Control: max-age=31536000, immutable`.

### 7.2 Product Media Storage (Images, Avatars)

Customer-uploaded files (product photos, category banners, user avatars) cannot be stored inside ephemeral container filesystems because containers reset on redeploy.

#### Option A: Persistent Disk Volume (Included in `render.yaml`)
A persistent block volume (10 GB) is mounted at `/data/media`.
* `MEDIA_ROOT = /data/media`
* `SERVE_MEDIA_FILES = true`
* The files survive service restarts and redeployments.

#### Option B: Object Storage (AWS S3 / Cloudflare R2)
For multi-instance horizontal scaling, configure `django-storages` with S3:
1. Add `django-storages[s3]>=1.14` and `boto3>=1.34` to `requirements.txt`.
2. Configure AWS S3 credentials:
   ```env
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   AWS_STORAGE_BUCKET_NAME=novastore-production-media
   AWS_S3_REGION_NAME=us-east-1
   AWS_S3_CUSTOM_DOMAIN=cdn.yourdomain.com
   DEFAULT_FILE_STORAGE=storages.backends.s3boto3.S3Boto3Storage
   ```

---

## 8. Frontend API Configuration & Reverse Proxying

### 8.1 API Base URL Configuration

The frontend Axios client (`frontend/src/api/axiosClient.js`) resolves the API endpoint through `VITE_API_BASE_URL`.

* **Single Domain / Reverse Proxy Setup:**
  If an Nginx reverse proxy or Cloudflare routes `/api/v1` to the backend:
  ```env
  VITE_API_BASE_URL=/api/v1
  ```
* **Decoupled Cross-Domain Setup:**
  If the frontend runs on `https://yourdomain.com` and backend runs on `https://api.yourdomain.com`:
  ```env
  VITE_API_BASE_URL=https://api.yourdomain.com/api/v1
  ```

### 8.2 Client-Side SPA Routing

Because React Router handles routing in the browser, requesting a URL like `https://yourdomain.com/products/wireless-keyboard` directly from the web server returns a 404 unless a rewrite rule is in place.

In `render.yaml`:
```yaml
routes:
  - type: rewrite
    source: /*
    destination: /index.html
```

On Nginx, this corresponds to:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

---

## 9. Domain, HTTPS, CORS, and CSRF Configuration

### 9.1 DNS Configuration

Configure DNS records with your registrar or Cloudflare:

| Record Type | Host | Points To / Value | Proxy Status |
| :--- | :--- | :--- | :--- |
| **CNAME** | `www` | `novastore-frontend.onrender.com` | Proxied |
| **ALIAS / ANAME** | `@` (apex) | `novastore-frontend.onrender.com` | Proxied |
| **CNAME** | `api` | `novastore-backend.onrender.com` | DNS Only (or Proxied) |

### 9.2 HTTPS & Reverse Proxy Headers

Render automatically issues and renews Let's Encrypt SSL/TLS certificates.
In `backend/config/settings/production.py`, the following security settings are active:
* `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')` informs Django that requests forwarded by the load balancer are secure.
* `SECURE_SSL_REDIRECT = True` redirects all insecure HTTP traffic to HTTPS.
* `SECURE_HSTS_SECONDS = 31536000` enforces HTTP Strict Transport Security for 1 year.
* `SECURE_HSTS_INCLUDE_SUBDOMAINS = True`
* `SECURE_HSTS_PRELOAD = True`

### 9.3 CORS and CSRF Alignment

Cross-origin requests with credentials (cookies) require exact domain matching (wildcards `*` are disallowed by the browser security model when credentials are sent):

```env
# Backend Environment Configuration
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CSRF_TRUSTED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://api.yourdomain.com
```

Cookies are transmitted with:
* `SESSION_COOKIE_SECURE = True`
* `CSRF_COOKIE_SECURE = True`
* `AUTH_COOKIE_SECURE = True`
* `AUTH_COOKIE_SAMESITE = 'Lax'`

---

## 10. Email and Payment Provider Configuration

### 10.1 Transactional Email (SendGrid / AWS SES)

In production, set `EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'` and configure:

```env
DEFAULT_FROM_EMAIL=NovaStore Support <orders@yourdomain.com>
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=SG.your_actual_sendgrid_api_key_here
EMAIL_TIMEOUT=10
```

#### DNS Deliverability Records
Ensure the following DNS TXT records are created for `yourdomain.com`:
* **SPF:** `v=spf1 include:sendgrid.net ~all`
* **DKIM:** Add the CNAME records provided by SendGrid/AWS SES.
* **DMARC:** `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com`

---

### 10.2 Payment Gateway (Simulated vs Stripe)

The platform features an enterprise Payment Adapter Architecture (`apps/payments/adapters/`):
* `simulated`: Safe test-mode gateway for local development and staging environments. No external network requests; supports declining cards via test token `tok_test_declined`.
* `stripe`: Integrates with Stripe PaymentIntents API with HMAC-SHA256 signature verification.

#### Live Stripe Rollout Checklist
Do NOT switch to live Stripe payments until completing all steps:
1. Verify business entity, bank details, and merchant account approval in the Stripe Dashboard.
2. Retrieve API keys from Stripe Dashboard -> Developers -> API Keys.
3. Configure the Stripe Webhook:
   * Webhook URL: `https://api.yourdomain.com/api/v1/payments/webhook/stripe/`
   * Events to listen to:
     * `payment_intent.succeeded`
     * `payment_intent.payment_failed`
     * `charge.refunded`
4. Copy the Webhook Signing Secret (`whsec_...`).
5. Update backend environment variables:
   ```env
   PAYMENT_GATEWAY=stripe
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
6. Verify live transactions using Stripe Dashboard test charges before opening to public traffic.

---

## 11. Database Backup & Disaster Recovery

### 11.1 Automated Backups

* **Render PostgreSQL:** Performs automated daily backups retained according to plan.
* **AWS RDS / DigitalOcean:** Enable automated snapshots with point-in-time recovery (PITR) enabled (7 to 30 days retention).

### 11.2 Manual Ad-Hoc Backup (`pg_dump`)

Run an encrypted or compressed backup before applying major schema migrations:

```bash
# Connect and dump database to a compressed file
pg_dump "postgresql://novastore_user:password@hostname:5432/novastore_prod?sslmode=require" \
  --format=custom \
  --blobs \
  --verbose \
  --file="backup_novastore_$(date +%Y%m%d_%H%M%S).dump"
```

### 11.3 Database Restoration (`pg_restore`)

To restore from a dump file:

```bash
# Terminate active connections (if needed)
psql "postgresql://novastore_user:password@hostname:5432/novastore_prod?sslmode=require" -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE datname = 'novastore_prod' AND pid <> pg_backend_pid();"

# Restore using pg_restore
pg_restore \
  --dbname="postgresql://novastore_user:password@hostname:5432/novastore_prod?sslmode=require" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --verbose \
  "backup_novastore_20261024_060000.dump"
```

---

## 12. Logging, Monitoring & Health Checks

### 12.1 Health Check Endpoint

Query the zero-authentication health check endpoint to verify database connectivity:
```bash
curl -i https://api.yourdomain.com/api/v1/common/health/
```

**Expected HTTP 200 Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "connected",
    "engine": "postgresql",
    "version": "0.1.0"
  }
}
```

### 12.2 Logging & Sensitive Data Scrubbing

The backend incorporates a `SensitiveDataFilter` (`apps/payments/utils/logger.py`) that scrubs credit card numbers, passwords, CVVs, and token credentials from console logs before emission.

To view live production logs on Render:
1. Navigate to your service in the Render Dashboard.
2. Click **Logs** to view real-time Gunicorn and Django application events.

---

## 13. Zero-Downtime Updates & Rollback Procedures

### 13.1 Deployment Flow

```
1. Git Push (main branch)
        │
        ▼
2. Build Triggered (pip install & collectstatic / npm run build)
        │
        ▼
3. Pre-Deploy Hook (python manage.py migrate --no-input)
        │
        ├── Migration Failure? ──> ABORT (Old version remains active)
        │
        ▼
4. Gunicorn Startup & Health Check Probe (/api/v1/common/health/)
        │
        ├── Probe Failure? ────> ABORT (Traffic not routed)
        │
        ▼
5. Traffic Shift (Load balancer points traffic to new instance)
```

### 13.2 Instant Rollback Procedure

If a critical bug is detected in production after deployment:
1. In the Render Dashboard, open **novastore-backend** -> **Deploys**.
2. Locate the previous successful deploy.
3. Click the three dots (`...`) and select **Rollback to this deploy**.
4. The load balancer immediately shifts traffic back to the previous immutable container build.
5. If the migration was backwards-compatible, no database rollback is needed. If a down-migration is required, run:
   ```bash
   python manage.py migrate <app_name> <previous_migration_name>
   ```
