# TaskFlow

A full-stack task management application where teams can register, log in, create projects, manage tasks, and track progress — all in one place.

---

## What is TaskFlow?

TaskFlow is a minimal but production-ready project & task tracker. It lets you:

- Register and log in securely with JWT authentication
- Create and manage projects
- Add tasks with title, description, status, priority, due date, and assignee
- Filter tasks by status
- Track progress per project (done vs total)
- Cycle task status with a single click (optimistic UI — no page reload)
- Use it in dark or light mode

---

## How to Run

### Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A free [Neon DB](https://neon.tech) account (for the PostgreSQL database)

### Steps

**1. Clone the repo**
```bash
git clone <your-repo-url> taskflow
cd taskflow
```

**2. Set up environment variables**
```bash
cp .env.example .env
```

Open `.env` and fill in your Neon DB connection string:
```env
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=any_long_random_secret_string_here
PORT=8080
VITE_API_URL=http://localhost:8080
```

**3. Start the application**
```bash
docker compose up --build
```

That's it. Docker will:
- Build the Go API and React frontend
- Run all database migrations automatically
- Seed a test user and demo project

**4. Open the app**

| Service  | URL                    |
|----------|------------------------|
| Frontend | http://localhost:3000  |
| API      | http://localhost:8080  |

**5. Log in with the test account**
```
Email:    test@example.com
Password: password123
```

---

## Stopping the App

```bash
docker compose down
```

---

## Running Migrations Manually (optional)

Migrations run automatically on startup. If you need to run them manually:

```bash
go install -tags 'pgx5' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

migrate -path backend/migrations \
  -database "pgx5://user:password@host/dbname?sslmode=require" up
```

---

## Project Structure

```
taskflow/
├── backend/
│   ├── cmd/api/main.go              # Entry point
│   ├── internal/
│   │   ├── db/                      # DB connection + migrations
│   │   ├── handler/                 # HTTP handlers (auth, projects, tasks)
│   │   ├── middleware/              # JWT auth middleware
│   │   └── model/                   # Go structs
│   ├── migrations/                  # SQL migration files
│   ├── go.mod
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/                   # Login, Projects, ProjectDetail
│   │   ├── components/              # Navbar, TaskModal
│   │   ├── hooks/                   # TanStack Query hooks
│   │   ├── context/                 # Auth context
│   │   ├── lib/                     # Axios instance
│   │   └── types/                   # TypeScript interfaces
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Tech Stack & Why

### Backend

| Library / Tool | Why |
|---|---|
| **Go 1.22** | Fast, statically typed, small binaries, excellent for HTTP APIs |
| **Chi router** | Lightweight, idiomatic Go router — no magic, just middleware and routing |
| **pgx/v5** | Native PostgreSQL driver — faster and more correct than `database/sql` wrappers |
| **golang-migrate** | Versioned SQL migrations with up/down support — reproducible schema changes |
| **golang-jwt/jwt/v5** | Standard JWT library for Go — simple, well-maintained |
| **bcrypt (cost 12)** | Industry-standard password hashing — cost 12 balances security and speed |
| **godotenv** | Load `.env` files in development without changing production behaviour |
| **slog** | Go 1.21+ structured logger — built-in, no extra dependency needed |

### Frontend

| Library / Tool | Why |
|---|---|
| **React 18 + TypeScript** | Component model + type safety catches bugs at compile time |
| **Vite** | Instant dev server, fast HMR, optimised production builds |
| **React Router v6** | Declarative client-side routing with nested routes and protected routes |
| **TanStack Query v5** | Server state management — handles caching, background refetch, and optimistic updates cleanly |
| **Axios** | HTTP client with interceptors — used to attach JWT on every request and handle 401 globally |
| **Tailwind CSS v3** | Utility-first CSS — fast to write, consistent design, no unused CSS in production |

### Infrastructure

| Tool | Why |
|---|---|
| **Docker + Docker Compose** | Single command to run the full stack — no local Go/Node/Postgres setup needed |
| **Multi-stage Dockerfiles** | Stage 1 builds the binary/bundle, Stage 2 is a minimal runtime image — small final image size |
| **Neon DB** | Serverless PostgreSQL — free tier, no local Postgres container needed, scales automatically |
| **nginx** | Serves the React SPA in production with `try_files` fallback for client-side routing |

### Database

| Choice | Why |
|---|---|
| **PostgreSQL 16** | Native UUID generation (`gen_random_uuid()`), native ENUM types, `TIMESTAMPTZ` — all used in the schema |
| **Raw SQL (no ORM)** | Full control over queries, no N+1 surprises, easy to read and debug |
| **pgcrypto extension** | Provides `gen_random_uuid()` for UUID primary keys directly in the DB |

---

## Key Design Decisions

**Optimistic UI for task status** — When you click a task's status, the UI updates instantly. TanStack Query snapshots the previous state and rolls back automatically if the API call fails.

**Flat handler structure** — No repository layer or service layer. Handlers receive the DB pool directly. Simple enough for this scope and easier to follow.

**Migrations as seed** — The test user and demo data are migration `000002`, so they're versioned, reproducible, and reversible with `migrate down`.

**JWT in localStorage** — Auth state persists across page refreshes. The Axios interceptor attaches the token to every request automatically. On 401, it clears storage and redirects to login.

**Dark mode** — Toggled via Tailwind's `dark` class on `<html>`, persisted in `localStorage`.

---

## API Quick Reference

```
POST   /auth/register
POST   /auth/login

GET    /projects
POST   /projects
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id
GET    /projects/:id/stats

GET    /projects/:id/tasks   ?status=  ?assignee=
POST   /projects/:id/tasks
PATCH  /tasks/:id
DELETE /tasks/:id
```

All protected endpoints require: `Authorization: Bearer <token>`
