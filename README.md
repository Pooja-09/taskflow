# TaskFlow

A minimal but complete task management system with authentication, projects, and tasks.

## 1. Overview

TaskFlow lets users register, log in, create projects, add tasks, and assign tasks to team members.

**Stack:**
- **Backend:** Go 1.22, Chi router, PostgreSQL 16, golang-migrate, JWT (golang-jwt/jwt/v5), bcrypt
- **Frontend:** React 18 + TypeScript, Vite, React Router v6, TanStack Query v5, Axios, Tailwind CSS v3
- **Infra:** Docker Compose, multi-stage Dockerfiles, `.env`-based config

## 2. Architecture Decisions

**Backend structure** — flat handler/model/middleware layout inside `internal/`. No ORM; raw `pgx` queries give full control over SQL and avoid magic. Each handler receives a `*pgxpool.Pool` directly — simple enough for this scope, no need for a repository abstraction layer.

**Migrations** — `golang-migrate` with versioned SQL files. Runs automatically on server startup. Both up and down migrations provided. Seed data is migration `000002` so it's reproducible and reversible.

**JWT** — 24h expiry, `user_id` + `email` in claims, secret from env. Middleware sets typed context keys to avoid string collisions.

**Frontend state** — TanStack Query handles all server state (caching, invalidation, optimistic updates). Auth state lives in React context backed by `localStorage` for persistence across refreshes.

**Optimistic UI** — Task status changes update the UI immediately via TanStack Query's `onMutate` snapshot/rollback pattern. If the API call fails, the previous state is restored.

**What I left out:** pagination (the bonus), WebSocket real-time updates, and drag-and-drop. These would be the next additions with more time.

## 3. Running Locally

Requires: Docker and Docker Compose only.

```bash
git clone <your-repo-url> taskflow
cd taskflow
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000
- API: http://localhost:8080

The API runs database migrations automatically on startup. No manual steps needed.

## 4. Running Migrations

Migrations run automatically when the API container starts. If you need to run them manually against a local Postgres instance:

```bash
# Install golang-migrate
go install -tags 'pgx5' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Run migrations
migrate -path backend/migrations -database "pgx5://taskflow:taskflow_secret@localhost:5432/taskflow?sslmode=disable" up
```

## 5. Test Credentials

Seeded automatically on first run:

```
Email:    test@example.com
Password: password123
```

The seed also creates a "Demo Project" with 3 tasks (todo, in_progress, done) assigned to this user.

## 6. API Reference

### Auth

**POST /auth/register**
```json
// Request
{ "name": "Jane Doe", "email": "jane@example.com", "password": "secret123" }

// Response 201
{ "token": "<jwt>", "user": { "id": "uuid", "name": "Jane Doe", "email": "jane@example.com", "created_at": "..." } }
```

**POST /auth/login**
```json
// Request
{ "email": "jane@example.com", "password": "secret123" }

// Response 200
{ "token": "<jwt>", "user": { ... } }
```

All endpoints below require: `Authorization: Bearer <token>`

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List projects you own or have tasks in |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project + tasks |
| PATCH | `/projects/:id` | Update name/description (owner only) |
| DELETE | `/projects/:id` | Delete project + tasks (owner only) |
| GET | `/projects/:id/stats` | Task counts by status and assignee |

**POST /projects**
```json
// Request
{ "name": "My Project", "description": "Optional" }
// Response 201 — project object
```

**GET /projects/:id/stats**
```json
// Response 200
{
  "by_status": { "todo": 2, "in_progress": 1, "done": 3 },
  "by_assignee": [{ "assignee_id": "uuid", "count": 4 }]
}
```

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects/:id/tasks` | List tasks (`?status=`, `?assignee=`) |
| POST | `/projects/:id/tasks` | Create task |
| PATCH | `/tasks/:id` | Partial update |
| DELETE | `/tasks/:id` | Delete (owner or assignee) |

**POST /projects/:id/tasks**
```json
// Request
{ "title": "Design homepage", "priority": "high", "assignee_id": "uuid", "due_date": "2026-04-15" }
// Response 201 — task object
```

**PATCH /tasks/:id** — all fields optional
```json
{ "title": "Updated", "status": "done", "priority": "low", "assignee_id": "uuid", "due_date": "2026-04-20" }
```

### Error Responses

```json
// 400
{ "error": "validation failed", "fields": { "title": "is required" } }

// 401
{ "error": "unauthorized" }

// 403
{ "error": "forbidden" }

// 404
{ "error": "not found" }
```

## 7. What I'd Do With More Time

- **Pagination** on list endpoints (`?page=&limit=`) — straightforward to add, skipped for time
- **Integration tests** — at least auth + task CRUD with a test DB container
- **Drag-and-drop** task status columns (Kanban view) using `@dnd-kit`
- **WebSocket/SSE** for real-time task updates across users
- **Assignee UX** — right now assignee_id is a raw UUID input; a proper user search/select would be needed
- **Rate limiting** on auth endpoints to prevent brute force
- **Refresh tokens** — current 24h JWT is fine for a demo but production needs token rotation
- **Error boundary** in React for unexpected crashes
