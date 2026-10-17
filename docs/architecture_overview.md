# E-Commerce Project Architecture Overview

## 1. Directory Layout

```
.
├── backend/                  # Django REST Framework backend API
│   ├── config/               # Project configuration & settings modules
│   │   ├── settings/
│   │   │   ├── base.py       # Shared settings across all environments
│   │   │   ├── development.py# Local dev settings (SQLite/Local Postgres, CORS)
│   │   │   └── production.py # Production settings (AWS S3, SSL, strict security)
│   │   ├── asgi.py
│   │   ├── wsgi.py
│   │   └── urls.py           # Root URL configuration (/api/v1/)
│   ├── apps/                 # Modular domain applications
│   │   └── common/           # Shared models, pagination, error handler, permissions
│   ├── manage.py
│   ├── requirements.txt      # Production & base dependencies
│   └── requirements-dev.txt  # Development & test tooling
│
├── frontend/                 # React SPA (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── api/              # Axios instance and API service functions
│   │   ├── assets/           # Static images, SVG icons, fonts
│   │   ├── components/       # Reusable UI components (common, layout)
│   │   ├── contexts/         # React Contexts (AuthContext, CartContext)
│   │   ├── hooks/            # Custom React hooks (useAuth, useCart)
│   │   ├── layouts/          # Page shell layouts (RootLayout, AdminLayout)
│   │   ├── pages/            # View components mapped to routes
│   │   ├── routes/           # React Router route definitions
│   │   ├── styles/           # Tailwind CSS directives and custom styling
│   │   └── utils/            # Helper functions, constants, formatting
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
└── docs/                     # Specifications, API contracts, deployment guides
```

## 2. Core Architectural Patterns
- **Skinny Views, Fat Domain Services:** Views handle HTTP parsing and return responses. Multi-model business logic, inventory locking, and payment workflows reside in `services.py` within each domain app.
- **Secure Authentication:** JWT tokens (`access_token` and `refresh_token`) delivered via secure `HttpOnly`, `SameSite=Lax` cookies. Mutating requests validate the CSRF token via the `X-CSRFToken` header.
- **Atomic Concurrency:** Concurrency locks on checkout (`select_for_update()`) inside `@transaction.atomic` blocks to eliminate overselling.
- **Immutable Order Snapshots:** `OrderItem` records physical snapshots of product titles, variant SKUs, and unit prices at checkout time.
