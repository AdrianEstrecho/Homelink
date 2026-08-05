# HomeLink

**HomeLink** is an integrated online marketplace where customers can buy home improvement products (CCTV, ACs, solar equipment, plumbing, electrical, smart home devices) and book professional installation, maintenance, and repair services — all from one platform.

## Features

### Customer
- Register, login, and manage profile
- Browse and search products by category
- Shopping cart and secure checkout with promo codes
- Book installation/maintenance services with date/time scheduling
- Track orders and service bookings
- View policies, gallery, and business location

### Admin Dashboard
- Manage products, categories, and services
- Process orders and assign technicians to bookings
- Manage users (customers and employees)
- Sales reports and revenue analytics
- Announcements and voucher management

### Employee Portal
- View assigned service schedules
- Update job status (Pending → In Progress → Completed)
- Record completion notes

### Integrations
- **Email API** — Order/booking confirmations (mock mode without SMTP config)
- **Location API** — Google Maps integration for business location
- **Payment Gateway** — Simulated secure payment processing
- **Promos** — Holiday discounts, first-time service discount, voucher codes

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, React Router
- **Backend:** Node.js, Express, SQLite (better-sqlite3)
- **Auth:** JWT with role-based access (customer, employee, admin)

## Quick Start

### Prerequisites
- Node.js 18+

### Setup

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Seed the database with sample data
cd ../backend && npm run seed

# Start backend (terminal 1)
npm run dev

# Start frontend (terminal 2)
cd ../frontend && npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Demo Accounts

| Role     | Email                        | Password    | Login URL                              |
|----------|------------------------------|-------------|-----------------------------------------|
| Admin    | admin@homelink.com           | admin123    | http://localhost:5173/admin/login       |
| Employee | juan.delacruz@homelink.com   | password123 | http://localhost:5173/admin/login       |
| Customer | customer@demo.com            | password123 | http://localhost:5173/login             |

Staff (admin and employee) sign in at the dedicated staff portal, `/admin/login`, separate
from the customer login at `/login`. Each portal only accepts its own account types — a
customer credential entered at `/admin/login` (or a staff credential entered at `/login`)
is rejected. Logging out of the admin dashboard returns to `/admin/login`.

## Promo Codes

- `HOMELINK10` — 10% off (min ₱5,000)
- `SAVE500` — ₱500 off (min ₱3,000)
- `NEWHOME20` — 20% off (min ₱10,000)

First-time service bookings automatically receive 15% off.

## Project Structure

```
homelink/
├── backend/
│   ├── db/           # Database schema & seed
│   ├── routes/       # API routes
│   ├── middleware/   # Auth middleware
│   └── utils/        # Email & promo helpers
└── frontend/
    └── src/
        ├── components/
        ├── context/  # Auth & Cart state
        └── pages/    # Customer, Admin, Employee views
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

```
PORT=5000
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:5173
SMTP_USER=your-email@gmail.com   # Optional for real emails
SMTP_PASS=your-app-password
```

## License

Built for academic/research purposes.
