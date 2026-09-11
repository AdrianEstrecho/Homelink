# HomeLink — High-Level System Architecture

HomeLink is a home-improvement marketplace: customers buy products and book installation/maintenance
services from one platform, with separate portals for customers, employees, and admins, plus a
companion mobile app.

## Diagram

```mermaid
flowchart TB
    subgraph Clients
        CW["Customer Web App<br/>React 18 + Vite + Tailwind + React Router"]
        AW["Admin Web App<br/>React 18 (same SPA, role-gated /admin/* routes)"]
        MA["Mobile Application<br/>Angular 22 + Capacitor<br/>(Android build + Vercel web build)"]
    end

    subgraph Backend["API / Backend — Node.js + Express (modular monolith)"]
        GW["Express App Server<br/>server.js — CORS, JSON body parsing, routing"]
        AUTH["Auth service<br/>JWT, role-based access, Google OAuth, 2FA"]
        CATALOG["Catalog service<br/>products, services, categories"]
        ORDERS["Orders & Bookings service<br/>cart, checkout, scheduling, fulfillment"]
        ADMIN["Admin & Employee service<br/>user mgmt, reports, technician assignment"]
        SUPPORT["Support & Notifications service<br/>messages, tickets, notifications, reviews, wishlist"]
        PAY["Payments service<br/>PayMongo Checkout Sessions + webhook"]
    end

    DB[("PostgreSQL<br/>hosted on Supabase")]

    subgraph External["External APIs"]
        RESEND["Resend<br/>transactional email"]
        GMAPS["Google Maps<br/>business location"]
        GOAUTH["Google OAuth<br/>social login"]
        PAYMONGO["PayMongo<br/>cards / GCash / QR Ph"]
    end

    CW -->|HTTPS/JSON| GW
    AW -->|HTTPS/JSON| GW
    MA -->|HTTPS/JSON| GW

    GW --> AUTH
    GW --> CATALOG
    GW --> ORDERS
    GW --> ADMIN
    GW --> SUPPORT
    GW --> PAY

    AUTH --> DB
    CATALOG --> DB
    ORDERS --> DB
    ADMIN --> DB
    SUPPORT --> DB
    PAY --> DB

    AUTH --> GOAUTH
    SUPPORT --> RESEND
    ORDERS --> RESEND
    CW --> GMAPS
    PAY --> PAYMONGO
```

> The backend is a single Express service organized into route modules (auth, products, services,
> orders, bookings, admin, employee, addresses, payment-methods, reviews, support, notifications,
> messages, wishlist, cart, payments) rather than independently deployed microservices. The diagram
> groups them as logical "services" within that one process for clarity — deploying them as separate
> services is a possible future step, not the current state.

## Components & Technology

| Component | Technology | Notes |
|---|---|---|
| Customer Web App | React 18, Vite, Tailwind CSS, React Router | Deployed on Vercel |
| Admin Web App | React 18 (same codebase as customer app, `/admin/*` routes) | Separate login at `/admin/login` |
| Mobile Application | Angular 22, Capacitor, Tailwind CSS, RxJS | Packaged as an Android app via Capacitor; also deployed as a web build on Vercel |
| API / Backend | Node.js, Express, JWT auth | Modular monolith, deployed on Render |
| Database | PostgreSQL (Supabase) | Accessed via `pg`; previously ran on SQLite (local dev) / Neon before settling on Supabase |
| External APIs | Resend, Google Maps, Google OAuth, PayMongo | See below |

### External API usage

- **Resend** — order/booking confirmation emails, password reset, verification codes
- **Google Maps** — renders the business location on the customer site
- **Google OAuth** — social sign-in alongside email/password
- **PayMongo** — hosted Checkout Sessions for card, GCash, and QR Ph payments, plus a webhook
  (`POST /api/payments/webhook`) for payment status confirmation

## Deployments

| Surface | URL |
|---|---|
| Customer/Admin Web App (frontend) | https://homelink-frontend-umber.vercel.app |
| Backend API | https://homelink-backend-vwg8.onrender.com |
| Mobile app (web build) | https://homelink-mobile-app.vercel.app |
| GitHub repository | https://github.com/AdrianEstrecho/Homelink |
