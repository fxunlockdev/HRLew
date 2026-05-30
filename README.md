# HRLew — Recruitment Operations CRM

An end-to-end CRM for recruitment firms. Manages candidates, clients, jobs,
business development, multi-stage pipelines, interviews, placements, staff,
tasks, KPIs and RBAC — built on **Next.js 15 + Supabase + Tailwind +
shadcn/ui** and ready to deploy on **Railway**.

> Designed to replace spreadsheets and become the single source of truth for
> a small-to-midsize recruitment agency.

---

## Highlights

- **Google OAuth via Supabase Auth** — invite-only access with an admin
  approval gate. The first user automatically becomes admin; everyone else
  lands in `pending` until an admin activates them.
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
- **CSV import + resume upload to Supabase Storage**.
- **Recharts dashboards** with revenue gated by permission.
- **Railway-ready** with `railway.json`, `nixpacks.toml`, and a `/api/health`
  endpoint.

---

## Tech stack

| Layer       | Choice                                            |
| ----------- | ------------------------------------------------- |
| Framework   | Next.js 15 (App Router, React 19, Server Actions) |
| Styling     | Tailwind CSS + shadcn/ui (new-york preset)        |
| Database    | Supabase Postgres                                 |
| Auth        | Supabase Auth + Google OAuth                      |
| Storage     | Supabase Storage (resumes bucket)                 |
| Data layer  | `@supabase/ssr` + server actions                  |
| Charts      | Recharts                                          |
| Forms       | react-hook-form + zod                             |
| Tables      | TanStack Table primitives (light usage)           |
| Testing     | Playwright                                        |
| Deployment  | Railway (Nixpacks builder)                        |

---

## Quickstart

### 1. Clone & install

```bash
git clone https://github.com/fxunlockdev/HRLew.git
cd HRLew
npm install
```

### 2. Create a Supabase project

1. Sign in at <https://supabase.com> and create a new project.
2. From the project dashboard grab three keys (Settings → API):
   - **Project URL**       → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key**   → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service role key**  → `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose to the browser)

### 3. Apply database migrations

Apply migrations in order from `supabase/migrations/`. Two options:

**Option A — Supabase CLI** *(recommended for repeatability)*

```bash
brew install supabase/tap/supabase   # or see docs
supabase link --project-ref <your-ref>
supabase db push                     # applies all migrations under supabase/migrations
```

**Option B — Paste in the SQL editor**

Open each file under `supabase/migrations/` in order (`0001_*` through
`0006_*`) and run them in Supabase Studio → SQL Editor.

Optionally seed demo data:

```bash
psql "$DATABASE_URL" -f supabase/demo_data.sql
```

### 4. Enable Google OAuth

1. In Supabase Studio → Authentication → Providers → Google → enable.
2. Configure a Google OAuth client at
   <https://console.cloud.google.com/apis/credentials>:
   - Authorized JavaScript origins: `https://<your-app>.up.railway.app` and `http://localhost:3000`
   - Authorized redirect URIs: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Paste the Client ID and Secret into Supabase.
4. Under Authentication → URL Configuration, set the Site URL to your
   deployed app URL and add `http://localhost:3000` as an additional
   redirect URL.

### 5. Configure env vars

```bash
cp .env.example .env.local
```

Fill in the Supabase keys, then:

```bash
npm run dev
```

Visit <http://localhost:3000>. Sign in with Google — **the very first
user is automatically promoted to admin** (see `handle_new_auth_user()`
in `0001_init_auth_rbac.sql`). Subsequent users land as `pending` and
must be activated from `/permissions`.

---

## Project structure

```
HRLew/
├── e2e/                          # Playwright tests
├── middleware.ts                 # session refresh + route protection
├── nixpacks.toml                 # Railway/Nixpacks build config
├── railway.json                  # Railway deploy config
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
│   │   ├── auth/                 # login, callback, pending
│   │   └── api/health/           # healthcheck for Railway
│   ├── components/
│   │   ├── ui/                   # shadcn primitives
│   │   ├── layout/               # sidebar, topbar, filter bar
│   │   ├── dashboard/            # KPI cards + charts
│   │   ├── candidates/ …         # per-module components
│   ├── lib/
│   │   ├── supabase/             # browser, server, middleware, admin clients
│   │   ├── auth.ts               # requireAuth + requirePermission
│   │   ├── rbac.ts               # hasPermission, redaction helpers
│   │   ├── settings.ts           # cached settings list fetcher
│   │   ├── types/                # hand-rolled domain types
│   │   └── utils.ts              # formatters
│   └── server/actions/           # all server actions
└── supabase/
    ├── migrations/               # 6 sequential migrations
    ├── seed.sql                  # for `supabase db reset`
    └── demo_data.sql             # optional sample data
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
3. **Database** — Row-Level Security policies in `0005_rls_policies.sql`. Even a raw API call cannot bypass these. Sensitive *column*-level restrictions (e.g. placements.placement_revenue) are enforced at the app layer because Postgres RLS is row-scoped.

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

1. Push to GitHub (this repo).
2. Create a new Railway project → Deploy from GitHub repo.
3. Add the following environment variables in the Railway dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (e.g. `https://hrlew.up.railway.app`)
   - `NODE_ENV=production`
4. Railway will pick up `nixpacks.toml` and `railway.json` automatically.
   Healthcheck path is `/api/health`.
5. Once deployed, update Google OAuth + Supabase Auth Site URL to point at
   the Railway domain.

---

## Scripts

```bash
npm run dev        # local dev server
npm run build      # production build
npm run start      # start production server (Railway uses this)
npm run lint       # next lint
npm run typecheck  # tsc --noEmit
npm run test:e2e   # Playwright tests (runs against local dev server)
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
- **Client portal** / **candidate portal** via separate routes that
  reuse the same Supabase schema with portal-specific RLS.
- **Invoice generation** from `placements` rows.
- **Recruiter incentive calculation** using `kpi_targets` × outcomes.

---

## License

Private — internal use only.
