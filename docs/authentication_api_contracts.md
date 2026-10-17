# Authentication & Authorization API Contracts and Security Architecture

## 1. Security Architecture Overview

This platform implements enterprise-grade, defense-in-depth authentication and role-based authorization designed specifically for a decoupled React SPA and Django REST Framework API.

### 1.1 Token Storage & Cookie Settings
- **Access Tokens (`access_token`)**: Delivered via secure, `HttpOnly` cookies with `SameSite=Lax`. Prevents cross-site script (XSS) token extraction. Default lifetime: 30 minutes.
- **Refresh Tokens (`refresh_token`)**: Delivered via secure, `HttpOnly` cookies with `SameSite=Lax`. Default lifetime: 7 days.
- **Dual Client Support**: While the React SPA leverages credentials cookies (`withCredentials: true`), API clients and automation can also authenticate via the standard `Authorization: Bearer <token>` header.
- **Production Cookie Settings**:
  - `AUTH_COOKIE_SECURE = True` (enforces HTTPS transmission).
  - `AUTH_COOKIE_HTTPONLY = True` (inaccessible to `document.cookie`).
  - `AUTH_COOKIE_SAMESITE = 'Lax'` (mitigates CSRF on third-party origins).
  - `AUTH_COOKIE_PATH = '/'`.

### 1.2 Cross-Site Request Forgery (CSRF) Protection
- **Double Submit Cookie Pattern**: The server provides a readable `csrftoken` cookie (`HttpOnly=False`, `SameSite=Lax`).
- **Client Transmission**: The React Axios client reads `csrftoken` and attaches it to the `X-CSRFToken` request header for mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`).
- **Server Enforcement**: When requests are authenticated via cookies (`CookieJWTAuthentication`), mutating requests strictly validate the CSRF token. Requests failing CSRF verification receive `403 Forbidden`. Header-based (`Bearer`) authentication bypasses ambient CSRF checks safely per RFC specifications.
- **CSRF Priming Endpoint**: `GET /api/v1/auth/csrf/` ensures a valid CSRF cookie is initialized before authenticated or mutating requests.

### 1.3 Role-Based Access Control (RBAC) & Ownership Isolation
- **Role Hierarchy**:
  - **Anonymous / Guest**: Read-only public catalog access, session cart.
  - **Customer (`is_staff=False`)**: Access restricted strictly to own profile, addresses, cart, orders, and submitted reviews.
  - **Administrator / Staff (`is_staff=True` / `is_superuser=True`)**: Catalog management, order status modification, customer address oversight, and review moderation.
- **Zero-Trust Client Input**:
  - Client-supplied `is_staff`, `is_superuser`, `role`, or `permissions` in registration or profile update payloads are strictly stripped and discarded.
  - Ownership (`user`) on addresses, carts, orders, and reviews is bound strictly to `request.user` on the server.
  - Product unit prices, coupon discounts, shipping fees, tax amounts, and order totals are calculated exclusively server-side from verified database records.

### 1.4 Password Security & Cryptography
- Passwords are never stored in plaintext. Passwords are cryptographically hashed using PBKDF2 with SHA256 (Django default, 720,000+ iterations).
- Minimum strength validations enforced via `AUTH_PASSWORD_VALIDATORS`:
  - `UserAttributeSimilarityValidator`
  - `MinimumLengthValidator`
  - `CommonPasswordValidator`
  - `NumericPasswordValidator`
- Password reset tokens use cryptographic single-use HMAC tokens (`default_token_generator`), which are invalidated immediately upon password change.
- Generic responses protect against user account enumeration attacks during password reset.

### 1.5 Verified Production Configuration Check
Production configuration was explicitly verified against Django's deployment security check suite (`python manage.py check --deploy --settings=config.settings.production`):
- `SECURE_SSL_REDIRECT = True`
- `SESSION_COOKIE_SECURE = True`
- `CSRF_COOKIE_SECURE = True`
- `AUTH_COOKIE_SECURE = True`
- `SECURE_BROWSER_XSS_FILTER = True`
- `SECURE_CONTENT_TYPE_NOSNIFF = True`
- `X_FRAME_OPTIONS = 'DENY'`
- `SECURE_HSTS_SECONDS = 31536000` (HSTS preload & subdomains enabled)
- Result: **0 errors, 0 warnings, 0 silenced**.

---

## 2. API Endpoint Contracts

### 2.1 CSRF Initialization
- **Route**: `GET /api/v1/auth/csrf/`
- **Permission**: `AllowAny`
- **Response**:
  ```json
  {
    "success": true,
    "message": "CSRF cookie established.",
    "data": {
      "csrfToken": "v7F4b...39xQ"
    }
  }
  ```
- **Cookies Set**: `csrftoken` (`HttpOnly=False`, `SameSite=Lax`).

---

### 2.2 Customer Registration
- **Route**: `POST /api/v1/auth/register/`
- **Permission**: `AllowAny`
- **Request Body**:
  ```json
  {
    "username": "johndoe",
    "email": "john@example.com",
    "password": "StrongPassword123!",
    "password_confirm": "StrongPassword123!",
    "first_name": "John",
    "last_name": "Doe"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Account registered successfully.",
    "data": {
      "user": {
        "id": 1,
        "username": "johndoe",
        "email": "john@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "is_staff": false,
        "is_superuser": false
      },
      "tokens": {
        "access": "eyJhbGci...",
        "refresh": "eyJhbGci..."
      }
    }
  }
  ```
- **Cookies Set**: `access_token` (HttpOnly), `refresh_token` (HttpOnly), `csrftoken`.

---

### 2.3 Login
- **Route**: `POST /api/v1/auth/login/`
- **Permission**: `AllowAny`
- **Request Body**: (Accepts username or email)
  ```json
  {
    "username": "john@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "data": {
      "user": {
        "id": 1,
        "username": "johndoe",
        "email": "john@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "is_staff": false,
        "is_superuser": false
      },
      "tokens": {
        "access": "eyJhbGci...",
        "refresh": "eyJhbGci..."
      }
    }
  }
  ```
- **Response (401 Unauthorized)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "INVALID_CREDENTIALS",
      "message": "Invalid username or password.",
      "details": { ... }
    }
  }
  ```
- **Cookies Set**: `access_token` (HttpOnly), `refresh_token` (HttpOnly).

---

### 2.4 Logout
- **Route**: `POST /api/v1/auth/logout/`
- **Permission**: `AllowAny`
- **Request Body**: Optional `{ "refresh": "..." }` if not using cookie.
- **Action**: Blacklists active refresh token in database and expires auth cookies.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully."
  }
  ```
- **Cookies Cleared**: `access_token` (expired), `refresh_token` (expired).

---

### 2.5 Token Refresh & Rotation
- **Route**: `POST /api/v1/auth/token/refresh/`
- **Permission**: `AllowAny`
- **Request Body**: Optional `{ "refresh": "..." }` or reads from `refresh_token` cookie.
- **Action**: Validates token, blacklists previous refresh token, issues new access and rotated refresh token.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Token refreshed successfully.",
    "data": {
      "tokens": {
        "access": "eyJhbGci...",
        "refresh": "eyJhbGci..."
      }
    }
  }
  ```

---

### 2.6 Current User Profile
- **Route**: `GET /api/v1/auth/me/`
- **Permission**: `IsAuthenticated`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "is_staff": false,
      "is_superuser": false,
      "profile": {
        "phone_number": "+15551234",
        "avatar": null,
        "date_of_birth": "1990-05-15",
        "is_newsletter_subscribed": true
      }
    }
  }
  ```

---

### 2.7 Profile Update
- **Route**: `PATCH /api/v1/auth/me/` (or `PUT`)
- **Permission**: `IsAuthenticated`
- **Request Body**:
  ```json
  {
    "first_name": "Jonathan",
    "last_name": "Doe",
    "profile": {
      "phone_number": "+15559876",
      "is_newsletter_subscribed": false
    }
  }
  ```
- **Security Check**: Attempts to update `is_staff`, `is_superuser`, `email`, `username`, or `id` are silently stripped/ignored.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Profile updated successfully.",
    "data": { ... }
  }
  ```

---

### 2.8 Password Change
- **Route**: `POST /api/v1/auth/password/change/`
- **Permission**: `IsAuthenticated`
- **Request Body**:
  ```json
  {
    "old_password": "CurrentPassword123!",
    "new_password": "NewStrongPassword456!",
    "new_password_confirm": "NewStrongPassword456!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Password changed successfully.",
    "data": {
      "tokens": {
        "access": "eyJhbGci...",
        "refresh": "eyJhbGci..."
      }
    }
  }
  ```

---

### 2.9 Password Reset Request
- **Route**: `POST /api/v1/auth/password/reset/`
- **Permission**: `AllowAny`
- **Request Body**:
  ```json
  {
    "email": "john@example.com"
  }
  ```
- **Anti-Enumeration Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "If an account with that email exists, password reset instructions have been sent."
  }
  ```

---

### 2.10 Password Reset Confirm
- **Route**: `POST /api/v1/auth/password/reset/confirm/`
- **Permission**: `AllowAny`
- **Request Body**:
  ```json
  {
    "uid": "MQ",
    "token": "cbf72a-...",
    "new_password": "NewResetPassword789!",
    "new_password_confirm": "NewResetPassword789!"
  }
  ```
- **Action**: Verifies single-use HMAC token, updates password hash, invalidating the token permanently.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Password has been reset successfully. You can now log in with your new password."
  }
  ```

---

## 3. Ownership & Authorization Matrix

| Resource | Operation | Customer A | Customer B | Staff Admin | Unauthenticated |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Address** | Create | Allowed (bound to A) | Allowed (bound to B) | Allowed | 401 Unauthorized |
| **Address** | Read/Update/Delete | Allowed (own only) | 404/403 on A's addr | Allowed (any addr) | 401 Unauthorized |
| **Cart** | Read/Add/Remove/Clear | Allowed (own cart) | Allowed (own cart) | Allowed (own cart) | Allowed (session cart) |
| **Order** | Checkout / Place | Allowed (own cart) | Allowed (own cart) | Allowed | 401 Unauthorized |
| **Order** | View Details | Allowed (own only) | 404/403 on A's order | Allowed (any order) | 401 Unauthorized |
| **Order** | Update Status | 403 Forbidden | 403 Forbidden | Allowed (`SHIPPED`, etc.) | 401 Unauthorized |
| **Review** | Create | Allowed (own review) | Allowed (own review) | Allowed | 401 Unauthorized |
| **Review** | Update / Delete | Allowed (own review) | 403 on A's review | Allowed (any review) | 401/403 |
| **Review** | Approve / Moderate | 403 / ignored | 403 / ignored | Allowed | 401/403 |
| **Category** | Create / Update / Delete | 403 Forbidden | 403 Forbidden | Allowed | 401/403 |
| **Product** | Create / Update / Delete | 403 Forbidden | 403 Forbidden | Allowed | 401/403 |
