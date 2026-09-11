# HomeLink — Final Project Checklist

Status as of 2026-09-11, based on the actual state of the repository and its deployments.

## Submission Items

- [x] **Hosted Web Application URL**
      Frontend: https://homelink-frontend-umber.vercel.app
      Backend API: https://homelink-backend-vwg8.onrender.com

- [ ] **Mobile Application screenshots / demonstration**
      App exists (Angular 22 + Capacitor, in the `HomeLink - Mobile` project, `mobile/` folder) and
      is deployed at https://homelink-mobile-app.vercel.app and packaged as an Android build.
      **Still needed:** screenshots or a short screen recording of the mobile app for submission.

- [x] **GitHub repository link**
      https://github.com/AdrianEstrecho/Homelink

- [x] **High-Level System Architecture Diagram**
      See [ARCHITECTURE.md](./ARCHITECTURE.md) — covers Customer Web App, Admin Web App, Mobile
      Application, API/Backend, backend services, Database, and External APIs, with technology
      per component.

- [ ] **Technical contribution per group member**
      Git history currently shows nearly all commits from Adrian Estrecho (backend, frontend, and
      mobile app). One commit from a second contributor (`rapaconaldredarlan-afk`) updated the
      README/package.json/.gitignore.
      **Still needed:** a written contribution summary for every group member, including non-code
      work (design, testing, documentation, presentation prep) that wouldn't show up in git log.

- [ ] **Updated Final Project Checklist**
      This document — keep it updated as the remaining items above are completed.

- [ ] **Live demonstration / technical Q&A readiness**
      Demo accounts are seeded and working (see main [README.md](../README.md)):

      | Role     | Email                        | Password    |
      |----------|------------------------------|-------------|
      | Admin    | admin@homelink.com           | admin123    |
      | Employee | juan.delacruz@homelink.com   | password123 |
      | Customer | customer@demo.com            | password123 |

      Be ready to explain: why the backend is a modular monolith rather than true microservices,
      the Supabase/Postgres migration history (SQLite → Neon → Supabase), and the PayMongo
      payment flow (Checkout Sessions + webhook).

## Known gaps / things to double check before submitting

- The backend is **not** split into independent microservices — it's a single Express service
  with modular routes. Decide whether to relabel this honestly on the diagram/report (recommended)
  or actually split a service out before demo day.
- No architecture diagram or checklist existed in the repo before this doc — now tracked here and
  in `docs/ARCHITECTURE.md`.
- Confirm the `Homelink---Database` branch on GitHub is intentional to keep around, or delete it
  for a cleaner repo before submission.
- Fill in the group member contribution section above with actual names/roles.
