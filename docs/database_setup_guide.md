# Safe PostgreSQL Setup & Troubleshooting Guide for Windows

This guide provides step-by-step instructions to configure, run, and troubleshoot PostgreSQL for the E-Commerce backend on Windows without risking data loss or running destructive commands.

---

## 1. Architecture & Driver Overview

* **Engine:** `django.db.backends.postgresql`
* **Driver:** `psycopg` (version 3.x, binary wheels via `psycopg[binary]`)
* **Behavior:**
  * By default, Django targets **PostgreSQL**.
  * If PostgreSQL is unavailable and rapid zero-dependency local development is needed, an **explicit** fallback to SQLite can be activated by setting `USE_SQLITE_FALLBACK=True` or `DB_ENGINE=django.db.backends.sqlite3` in `backend/.env`.
  * SQLite is **never silently substituted** for PostgreSQL; the active engine is announced in the terminal output and reported via `/api/v1/common/health/`.

---

## 2. Installing PostgreSQL on Windows

Choose **one** of the following options:

### Option A: Via Windows Package Manager (winget) - Recommended
Run Windows PowerShell as Administrator:
```powershell
winget install PostgreSQL.PostgreSQL
```
After installation completes, restart your PowerShell terminal to reload your system PATH.

### Option B: Official EnterpriseDB (EDB) Installer
1. Download the latest installer from [EnterpriseDB Official Downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).
2. Run the `.exe` installer.
3. Keep the default port (`5432`) and locale.
4. Record the superuser password you assign to the `postgres` account.

---

## 3. Database & User Provisioning (Non-Destructive)

Open PowerShell and launch the PostgreSQL command-line tool `psql`:

```powershell
# Connect as postgres superuser
psql -U postgres -h localhost -p 5432
```

Execute the following SQL commands to create a dedicated user and database:

```sql
-- 1. Create a dedicated application user
CREATE USER ecommerce_user WITH PASSWORD 'your_strong_password_here';

-- 2. Create the application database with UTF-8 encoding
CREATE DATABASE ecommerce_db WITH OWNER ecommerce_user ENCODING 'UTF8';

-- 3. Grant schema permissions (PostgreSQL 15+)
\c ecommerce_db
GRANT ALL ON SCHEMA public TO ecommerce_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ecommerce_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ecommerce_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ecommerce_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ecommerce_user;

-- 4. Exit psql
\q
```

---

## 4. Configuring Backend Environment (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` (if not already done) and configure the database block:

```env
# ------------------------------------------------------------------------------
# PostgreSQL Configuration (psycopg v3)
# ------------------------------------------------------------------------------
DB_ENGINE=django.db.backends.postgresql
DB_NAME=ecommerce_db
DB_USER=ecommerce_user
DB_PASSWORD=your_strong_password_here
DB_HOST=localhost
DB_PORT=5432
DB_CONN_MAX_AGE=0
DB_SSLMODE=prefer
DB_CONNECT_TIMEOUT=3

# Set to False to enforce PostgreSQL connection
USE_SQLITE_FALLBACK=False
```

---

## 5. Non-Destructive Verification Steps

Run these commands inside `backend/` to verify configuration without modifying or deleting data:

### Step 1: Django System Configuration Check
```powershell
.\venv\Scripts\python.exe manage.py check
```
*Expected Output:*
```
[Database Notice] Active Engine: PostgreSQL (host=localhost:5432, db=ecommerce_db, user=ecommerce_user).
System check identified no issues (0 silenced).
```

### Step 2: Apply Database Migrations
```powershell
.\venv\Scripts\python.exe manage.py migrate
```

### Step 3: Verify Health Check Endpoint
Start the server:
```powershell
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```
Query the health check:
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/common/health/" -Method Get
```
*Expected JSON Response:*
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

---

## 6. Troubleshooting Matrix

| Symptom | Probable Cause | Safe Resolution |
| :--- | :--- | :--- |
| **`connection timeout expired` or `Connection refused`** | PostgreSQL service is stopped or port 5432 is blocked. | 1. Check service: `Get-Service *postgres*`<br>2. Start service: `Start-Service postgresql-x64-*`<br>3. Verify listening port: `Get-NetTCPConnection -LocalPort 5432` |
| **`FATAL: password authentication failed for user`** | Mismatched password in `backend/.env` or `pg_hba.conf` restrictions. | 1. Verify `DB_PASSWORD` in `backend/.env`<br>2. Reset password in `psql`: `ALTER USER ecommerce_user WITH PASSWORD 'new_password';` |
| **`FATAL: database "ecommerce_db" does not exist`** | The database has not been created yet. | Connect with `psql -U postgres` and run: `CREATE DATABASE ecommerce_db OWNER ecommerce_user;` |
| **`ImportError: no pq wrapper available`** | `psycopg` is missing compiled binary C-libraries. | Ensure `psycopg[binary]>=3.2` is installed: `.\venv\Scripts\python.exe -m pip install "psycopg[binary]"` |
| **Temporary need for local development without Postgres** | Working on frontend or offline without local database server. | Explicitly enable SQLite fallback in `backend/.env`: `USE_SQLITE_FALLBACK=True` |
