# PolyDial frontend

The two signed-in PolyDial portals, built from `polydial-screen-catalog.html`, each shipped as its own Docker image:

| App | Domain (per `polydial.com.conf`) | Host port | Image |
|---|---|---|---|
| Business/admin portal | admin.polydial.com | 3000 | `polydial/admin-frontend` |
| Restaurant portal | restaurant.polydial.com | 3001 | `polydial/restaurant-frontend` |

Stack: React 18, Vite 5, TypeScript (strict), Tailwind 3, React Router 6, TanStack Query 5, Recharts. Served by nginx in the container.

## Run with Docker

```bash
cp .env.example .env          # set API_BASE_URL, or USE_MOCKS=true for a demo
docker compose up --build -d
# admin      → http://localhost:3000
# restaurant → http://localhost:3001
```

Your existing host nginx (`polydial.com.conf`) already proxies `admin.polydial.com → :3000` and `restaurant.polydial.com → :3001`, so nothing changes there.

Build one image on its own:

```bash
docker build --build-arg APP=admin      -t polydial/admin-frontend .
docker build --build-arg APP=restaurant -t polydial/restaurant-frontend .
docker run -p 3000:80 -e USE_MOCKS=true polydial/admin-frontend
```

### Runtime configuration

The images contain no environment-specific values. At startup, `docker/40-write-env.sh` writes `/env.js` from these variables, so one image can run anywhere:

| Variable | Default | Meaning |
|---|---|---|
| `API_BASE_URL` | `https://api.polydial.com` | Base URL for every API call |
| `USE_MOCKS` | `false` | `true` runs the app on in-browser demo data. No backend needed |
| `APP_NAME` | `PolyDial` | Browser title prefix |

`env.js` and `index.html` are sent with `no-store`/`no-cache`; hashed `/assets/*` are cached for a year. Every unknown path falls back to `index.html` (SPA routing). `/healthz` returns 200 for the container healthcheck.

The API must allow CORS from both portal origins and accept `Authorization: Bearer <token>`.

## Local development

```bash
npm install
npm run dev:admin        # http://localhost:3000
npm run dev:restaurant   # http://localhost:3001
npm run typecheck
npm run build
```

Dev and build both read the repo-root `.env` (`API_BASE_URL`, `USE_MOCKS`, `APP_NAME`): a small Vite plugin (`packages/shared/vite-env-plugin.ts`) serves `/env.js` from it in `npm run dev:*` and writes it into `dist/` on `npm run build`. Edits to `.env` apply on the next page load. With no `.env`, the API defaults to `https://api.polydial.com` and mocks are off.

### Demo / mock mode

With `USE_MOCKS=true` every request goes to an in-browser fake backend (`packages/shared/src/mocks`). It is seeded with a restaurant, "Maple & Main Bistro", and saves changes to `localStorage`, so edits persist across reloads. Sign in with any seeded email (for example `admin@polydial.com`) and any password of 8+ characters. To start fresh, use **About → Reset demo data** in the admin portal, or clear the `pd_mock_db_v1` key. On the restaurant's Live orders board, new phone orders arrive every so often while it is open, so you can see the chime and highlighting.

## Layout

```
packages/shared/      @polydial/shared, used by both apps as TS source
  src/api/            types.ts (mirrors polydial_schema.sql), client.ts, endpoints.ts
  src/mocks/          seed data + mock router
  src/ui/             primitives, FormDialog (schema-driven forms + validation), DataTable, toasts
  src/auth/           AuthProvider, RequireAuth (role gating)
  src/layout/         AppShell (sidebar with live-line status), Logo
  src/features/       screens shared by both portals: auth, calls, customers, billing, phones, hours, languages
  tailwind.preset.cjs design tokens
apps/admin/           business portal
apps/restaurant/      restaurant portal
docker/               nginx.conf, entrypoint script
Dockerfile            multi-stage, ARG APP=admin|restaurant
docker-compose.yml
```

## Connecting the real API

The portals talk to the PolyDial Flask API (`hmaghaw/appointment_system`, `appointment_app/routes`). `packages/shared/src/api/endpoints.ts` picks the implementation at startup:

- `endpoints.flask.ts` (default): maps every call to the real route, e.g. login → `POST /api/auth/login`, calls → `POST /api/call-meta/list`, menus → `POST /api/restaurants/list_menus`. It injects `business_id` from the session JWT, unwraps the API's varying response envelopes, and converts shapes to `types.ts` (day numbering, naive datetimes, join-table diffs for item/section/menu relations).
- `endpoints.mock.ts` + `mocks/router.ts` (`USE_MOCKS=true`): the in-browser demo backend.

Pages only use `endpoints.ts`, so they don't change between the two.

Notes on the live API:

- There is no `/auth/me`; the session is rebuilt from the JWT, the cached user and `POST /api/business/get`.
- Requests don't send cookies (`credentials` omitted) because the API's CORS config allows `*`.
- Features with no API route yet reject with a clear "isn't available on the PolyDial API yet" message: team management, voice analytics, call insights, sentiment, reports, the database browser, the contact form, Google sign-in, and editing/deleting translations. Phone "primary" and "forwarding" settings are likewise not saved.
- Partial support: appointment edits only reschedule (`PUT /api/appointments` takes date + time); business profile edits are limited to the auto-recharge fields `PUT /api/business` accepts; top-up calls `POST /api/stripe/topup`, which credits the balance directly without taking a payment.

For testing, the API can accept any password for an existing user: set `LOGIN_SKIP_PASSWORD_CHECK=true` in the API's `.env`.

## Screen coverage

**Admin portal:** login / sign-up / forgot / reset / verify email / OAuth callbacks · dashboard · calendar (day/week/month, create/edit/cancel appointment) · calls with transcript viewer and filters · customers · services (+ per-language translations) · voice analytics · call insights · sentiment analysis · reports (generate, schedules) · phone numbers (search + buy, insufficient-funds flow) · premium numbers · business hours · translations · team management (invite, roles) · billing (balance, top-up, auto-recharge, ledger) · settings (profile, languages, numbers, services, hours) · database browser · contact · about.

**Restaurant portal:** login / Clover login / reset / verify / OAuth callbacks · restaurant hub · live orders (10s polling, chime, sound toggle, ready/delivered/cancel) · order history · kitchen voice control (Web Speech API with typed fallback, spoken confirmation) · menu overview · menu management (menus, sections, items per section, availability schedules) · items (list, quick add, edit, sold-out toggle, delete) · 6-step create-item wizard · `/edit-item/:id` (incl. invalid and not-found states) · combos (groups, choices, price adjustments) · categories · options · modifiers · tags · Clover sync · calls · customers · phone numbers · business hours · billing · settings.

**Not included (by choice):** public marketing pages, pricing and the onboarding funnel.

Role gating: billing and the database browser are admin-only. Team management is admin/manager. Clover sync is admin/manager.

## Notes

- Fonts load from Google Fonts (Bricolage Grotesque, Instrument Sans). Self-host them if the deployment can't reach Google.
- The admin bundle is ~220 KB gzipped, mostly Recharts. Route-level code splitting is an easy next step if it matters.
