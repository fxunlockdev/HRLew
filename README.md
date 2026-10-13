# HR OS — Recruitment Operations CRM

An end-to-end CRM for recruitment firms. Manages candidates, clients, jobs,
business development, multi-stage pipelines, interviews, placements, staff,
tasks, KPIs and RBAC — built on **Next.js 15 + Postgres + Tailwind +
shadcn/ui** and running entirely on **Railway**.

> Designed to replace spreadsheets and become the single source of truth for
> a small-to-midsize recruitment agency.

---

## Highlights

- **Email + password auth, administered in-app** — accounts are created by an
  admin from `/permissions`, which issues a one-time temporary password the
  user must replace at first sign-in. The first account on a fresh instance is
  created through a self-closing `/auth/setup` page. No external identity
  provider is involved.
- **Role-based access control** — 4 system roles (admin / manager /
  recruiter / viewer) × 50+ fine-grained permissions × Postgres-level
  Row-Level Security policies. Frontend and backend both enforce the same
  rules; sensitive financial fields (CTC, placement revenue, billing %,
  staff salary) are hidden from non-privileged roles.
- **13 modules** covering the full lifecycle: dashboard, candidates,
  clients, BD, jobs, pipeline, interviews, placements, KPIs & reports,
  staff, tasks, settings, permissions.
- **Job-specific candidate pipeline** — one candidate can be linked to many
  jobs; each link has its own stage, history, follow-up, offer amount and
  recruiter assignment. Kanban + drag-and-drop + auto-recorded stage
  history via DB triggers.
- **Audit log** — every mutation on candidates, clients, jobs, pipeline,
  interviews, placements, staff, tasks is captured to `activity_logs` with
  before/after JSONB via a generic Postgres trigger.
- **CSV import + resume upload to a Railway Bucket** (private S3-compatible
  object storage; downloads are short-lived presigned URLs).
- **Recharts dashboards** with revenue gated by permission.
- **Runs end-to-end on Railway** — app service, Postgres, and a Bucket in one
  project, with migrations applied by the pre-deploy command.

---

## Tech stack

| Layer       | Choice                                            |
| ----------- | ------------------------------------------------- |
| Framework   | Next.js 15 (App Router, React 19, Server Actions) |
| Styling     | Tailwind CSS + shadcn/ui (new-york preset)        |
| Database    | Railway Postgres                                  |
| Auth        | Own session layer — bcrypt + opaque cookie tokens |
| Storage     | Railway Bucket (S3-compatible, private)           |
| Data layer  | Kysely over `pg` + server actions                 |
| Charts      | Recharts                                          |
| Forms       | react-hook-form + zod                             |
| Tables      | TanStack Table primitives (light usage)           |
| Testing     | Vitest (unit) + Playwright (E2E)                  |
| Deployment  | Railway (Railpack builder)                        |

---

## Quickstart

### 1. Clone & install

```bash
git clone https://github.com/fxunlockdev/HRLew.git
cd HRLew
npm install
```

### 2. Start a Postgres database

Any Postgres 14+ will do. Locally:

```bash
docker run -d --name hros-db -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_DB=hros -p 55432:5432 postgres:16
```

### 3. Configure environment

```bash
cp .env.example .env
```

Set `DATABASE_URL` (privileged — migrations only) and `APP_DB_PASSWORD`. The
migration runner creates the `hr_app` role from that password; put the matching
connection string in `APP_DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:testpass@127.0.0.1:55432/hros
APP_DB_PASSWORD=apppass123
APP_DATABASE_URL=postgresql://hr_app:apppass123@127.0.0.1:55432/hros
```

> **Why two URLs?** Railway's Postgres user is a superuser, and superusers
> bypass row-level security — every policy in the schema would be decorative.
> The app connects as `hr_app` (`nobypassrls`), so RLS actually applies.
> Migrations keep using the privileged URL. The app falls back to
> `DATABASE_URL` if `APP_DATABASE_URL` is unset, and logs a warning saying RLS
> is not being enforced.

### 4. Apply migrations

```bash
npm run db:migrate          # schema + system seed (roles, permissions, lists)
npm run db:demo             # optional: a few demo clients/jobs/candidates
npm run db:status           # what has been applied
```

Migrations live in `db/migrations/`, run in filename order inside a
transaction each, and are recorded in `schema_migrations` with a checksum —
editing an already-applied file is refused rather than silently skipped.

### 5. Object storage (optional locally)

Resume and logo uploads need an S3-compatible bucket. Without one the app runs
fine and upload attempts report "File storage is not configured yet". On
Railway, create a Bucket and reference its variables into the service:
`BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`.

### 6. Run it

```bash
npm run dev
```

Visit <http://localhost:3000>. With no accounts in the database you land on
`/auth/setup`, which creates the first administrator and then refuses to serve
itself again. Everyone else is created by an admin from `/permissions`.

---

## Authentication

| Concern            | How it works                                                                 |
| ------------------ | ---------------------------------------------------------------------------- |
| Password storage   | bcrypt, cost 12, in `app_users.password_hash`                                |
| Session            | 32 bytes of randomness in an httpOnly cookie; only its SHA-256 is stored     |
| Session lifetime   | 30 days, slid forward at most every 15 minutes                               |
| Brute force        | 5 failed attempts locks the account for 15 minutes                           |
| Enumeration        | One generic error, and a dummy bcrypt compare so timing does not leak        |
| First account      | `/auth/setup`, guarded in SQL by `bootstrap_first_admin()`                   |
| Provisioning       | Admin creates the user; a one-time temporary password is shown once          |
| Forced rotation    | `must_change_password` gates every route until the user picks their own      |
| Password change    | Revokes every other session, then re-establishes the current one             |
| Admin recovery     | "Reset password" issues a new temporary password and signs the user out      |

`src/middleware.ts` only checks whether a session cookie is present — it runs on
the edge runtime, where a Postgres connection is not available. Authorisation
is decided server-side by `requireAuth()` / `requirePermission()`, which every
protected page and server action calls.

---

## Project structure

```
HRLew/
├── db/
│   ├── migrations/               # 8 sequential SQL migrations
│   └── demo_data.sql             # optional sample data
├── e2e/                          # Playwright tests
├── scripts/migrate.mjs           # migration runner
├── tests/unit/                   # Vitest unit tests
├── railway.json                  # Railway build/deploy config
├── src/
│   ├── app/
│   │   ├── (dashboard)/          # protected dashboard layout
│   │   │   ├── dashboard/        # KPI overview
│   │   │   ├── candidates/       # list + new + [id] + import
│   │   │   ├── clients/          # list + new + [id]
│   │   │   ├── bd/               # Kanban + new + [id]
│   │   │   ├── jobs/             # list + new + [id]
│   │   │   ├── pipeline/         # Kanban across stages
│   │   │   ├── interviews/       # list + calendar + new + [id]
│   │   │   ├── placements/       # list + new + [id]
│   │   │   ├── kpis/             # company + recruiter performance
│   │   │   ├── staff/            # list + new + [id]
│   │   │   ├── tasks/            # my/team/overdue
│   │   │   ├── settings/         # configurable lists editor
│   │   │   └── permissions/      # RBAC management
│   │   ├── auth/                 # setup, login, pending, change-password
│   │   └── api/
│   │       ├── health/           # healthcheck for Railway
│   │       ├── uploads/          # validated server-side upload
│   │       └── files/[...key]/   # authorised redirect to a presigned URL
│   ├── middleware.ts             # cookie-presence redirect (must live here)
│   ├── components/
│   │   ├── ui/                   # shadcn primitives
│   │   ├── layout/               # sidebar, topbar, filter bar
│   │   ├── dashboard/            # KPI cards + charts
│   │   ├── candidates/ …         # per-module components
│   ├── lib/
│   │   ├── db/                   # Kysely client, schema types, SQL helpers
│   │   ├── auth/                 # session, password, requireAuth/requirePermission
│   │   ├── storage.ts            # Railway Bucket (S3) access
│   │   ├── rbac.ts               # hasPermission, redaction helpers
│   │   ├── settings.ts           # cached settings list fetcher
│   │   ├── form.ts               # FormData parsing helpers
│   │   ├── types/                # hand-rolled domain types
│   │   └── utils.ts              # formatters
│   └── server/actions/           # all server actions
```

---

## RBAC model

| Role      | What they can do                                                                    |
| --------- | ----------------------------------------------------------------------------------- |
| admin     | Everything. Manage users, edit financials, configure stages, view audit logs.        |
| manager   | View+edit operational data, view sensitive/financial fields, **cannot edit salary**. |
| recruiter | View+edit candidates, clients, jobs, pipeline, interviews; no financial visibility.  |
| viewer    | Read-only across permitted modules.                                                  |

**Sensitive fields gated by permission:**

| Field                                | Permission required                |
| ------------------------------------ | ---------------------------------- |
| Candidate current/expected CTC       | `candidates.view_sensitive`        |
| Client commercial terms              | `clients.edit_commercial`          |
| Job salary band                      | `jobs.view_salary` / `edit_salary` |
| Placement offered CTC, revenue, %    | `placements.view_financial` / `edit_financial` |
| Staff salary, incentive, KPI targets | `staff.view_salary` / `edit_salary` |
| Company revenue KPIs                 | `kpi.view_company`                 |

**Enforcement happens in three places:**

1. **Frontend** — `hasPermission()` hides UI affordances.
2. **Server actions** — `requirePermission()` redirects with `?error=forbidden` if not allowed.
3. **Database** — Row-Level Security policies in `db/migrations/0006_rls_policies.sql`,
   which the app cannot bypass because it connects as `hr_app` (`nobypassrls`).
   Policies read the current actor from the `app.profile_id` GUC, which
   `withProfile()` publishes for the duration of each transaction — this is the
   replacement for Supabase's `auth.uid()`. Queries issued outside
   `withProfile()` see nothing, by design. Column-level restrictions (e.g.
   `placements.placement_revenue`) stay in the app layer, because RLS is
   row-scoped.

---

## Data model

Core entities and the relationships you should know about:

```
clients ─┬─< job_requirements ─┬─< candidate_job_pipeline >─ candidates
         │                     │                                  │
         │                     └─< placements                     │
         │                                                        │
         └─< client_contacts                                      │
                                                                  │
bd_leads ─< bd_activities       interviews >─────────────────────┘

profiles ─< role_permissions >─ permissions
profiles ─< (assignee on) candidates, jobs, pipeline, tasks, …
staff ─── profiles (optional 1:1 link)

activity_logs ─ append-only audit of every mutation on the above
```

Key design decision: **a candidate's stage is stored on
`candidate_job_pipeline`, not on `candidates`.** A single candidate can be
submitted to multiple jobs, each with its own stage, recruiter, and
history. This mirrors how recruitment firms actually operate.

---

## Deployment to Railway

Everything lives in one Railway project: the app service, a Postgres database,
and a Bucket.

1. **Postgres** — add a Postgres service. Reference its `DATABASE_URL` into the
   app service.
2. **Application role** — set `APP_DB_PASSWORD` on the app service; the
   pre-deploy migration creates the `hr_app` role from it. Then set
   `APP_DATABASE_URL` to the same connection string as `DATABASE_URL` with the
   user and password swapped to `hr_app`, pointing at
   `postgres.railway.internal` so traffic stays on the private network.
3. **Bucket** — add a Bucket and reference `BUCKET`, `ENDPOINT`, `REGION`,
   `ACCESS_KEY_ID` and `SECRET_ACCESS_KEY` into the app service.
4. **App** — deploy from GitHub. `railway.json` sets the Railpack builder, the
   `/api/health` healthcheck, and a pre-deploy command that runs
   `npm run db:migrate`, so each deploy migrates before the new container
   takes traffic.
5. **First sign-in** — open the deployed URL and complete `/auth/setup`.

Do **not** set `NODE_ENV=production` as a service variable. `next build` and
`next start` set it themselves, and having it in the environment makes
`npm ci` skip the devDependencies the build needs.

> **Config as Code is deprecated.** Railway stops reading `railway.json` on
> **2026-12-01**. Before then, migrate to Infrastructure as Code
> (`.railway/railway.ts`) with `railway config pull`, and delete `railway.json`
> — a service cannot be managed by both.

---

## Scripts

```bash
npm run dev          # local dev server
npm run build        # production build
npm run start        # start production server (Railway uses this)
npm run lint         # next lint
npm run typecheck    # tsc --noEmit
npm run db:migrate   # apply pending migrations
npm run db:status    # report migration state, change nothing
npm run db:demo      # apply db/demo_data.sql
npm test             # Vitest unit tests
npm run test:e2e     # Playwright E2E
```

E2E tests that need a signed-in user read credentials from the environment and
skip themselves without them:

```bash
E2E_EMAIL=admin@example.com E2E_PASSWORD=... npm run test:e2e
```

---

## Future enhancements

The schema and architecture are designed to accommodate these without
major rewrites:

- **Resume parsing** — wire up a job to parse `candidate_documents` rows
  into `candidates.skills/total_experience_years` via OpenAI/Anthropic.
- **AI candidate→job matching** — `pgvector` embeddings on
  `candidates.skills + bio` and `job_requirements.required_skills + description`.
- **Email + WhatsApp + Google Calendar integration** for interview
  reminders and BD follow-ups (`tasks.due_at` is the trigger).
- **Client portal** / **candidate portal** via separate routes that reuse the
  same schema with portal-specific RLS policies.
- **Invoice generation** from `placements` rows.
- **Recruiter incentive calculation** using `kpi_targets` × outcomes.

---

## Known gaps

- **Form labels are not associated with their inputs.** All eight entity forms
  render labels through a local `Field` wrapper that emits a `<Label>` with no
  `htmlFor`, so screen readers cannot announce which field is focused and
  `getByLabel` cannot find them in tests. Pre-existing; fixing it means giving
  `Field` a generated id (and putting it on `SelectTrigger` for the Radix
  selects).
- **No pagination on several list pages.** Jobs, interviews, placements, staff
  and BD cap at 50–500 rows rather than paging. Candidates and clients do page.
- **Offers-per-recruiter is always zero** on the KPIs "Recruiters" tab; the
  source data has no per-recruiter offer attribution. Carried over as-is.

---

## License

Private — internal use only.
