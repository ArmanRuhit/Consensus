# Consensus

A full-stack polling platform where authenticated users create polls, share them via public links, collect responses in anonymous or authenticated mode, view live analytics, and publish results — all in one place.

Built for the hackathon requirement: **single repository, both frontend and backend, real-time updates via WebSockets.**

---

## Features

- **Poll creation** — logged-in users create polls with multiple single-select questions, mark questions as mandatory or optional, set response mode (anonymous / authenticated), and configure an expiry time
- **Poll lifecycle** — polls are `active` until expiry, then `expired` (no more responses accepted), and can be `published` by the creator to display final results publicly
- **Lazy expiry** — polls expire automatically on access; no cron/scheduler needed
- **Anonymous response mode** — no login required to submit; rate-limited by IP
- **Authenticated response mode** — respondents must log in; one response per user enforced
- **Response submission** — smooth form experience with client + server validation for mandatory questions
- **Live analytics dashboard** — creators see response counts update in real time via Socket.io
- **Final results publishing** — creators publish results; the same public link then shows a read-only results view with counts and percentages
- **Rate limiting** — configurable throttle on response submission (default: 1 request per 10 seconds per poll)
- **OpenAPI docs** — interactive Swagger UI at `/api-docs`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS v4, React Router 7 |
| Backend | Node.js, Express 5, Socket.io, JWT, bcrypt, Zod |
| Database | PostgreSQL via Prisma 7 |
| Real-time | Socket.io (WebSocket) |
| API Docs | Swagger UI (OpenAPI 3.1) |

---

## Project Structure

```
consensus/
├── client/                  # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Signup.tsx
│   │   │   ├── Dashboard.tsx     # Create poll + My Polls list
│   │   │   ├── PollPage.tsx      # Public poll form / results view
│   │   │   └── PollManage.tsx    # Creator analytics & management
│   │   ├── lib/
│   │   │   ├── api.ts            # Fetch wrapper + API methods
│   │   │   ├── auth.tsx          # Auth context & provider
│   │   │   └── socket.ts         # Socket.io client
│   │   ├── App.tsx               # Routes & guards
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── server/                  # Express backend
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── app.ts                # Express app wiring
│   │   ├── config/
│   │   │   ├── env.ts            # Environment variable parsing
│   │   │   ├── prisma.ts         # Prisma client setup
│   │   │   ├── socket.ts         # Socket.io init + getIO()
│   │   │   └── openapi.ts        # OpenAPI spec
│   │   ├── routes/
│   │   │   ├── index.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── poll.routes.ts
│   │   ├── service/
│   │   │   ├── auth.service.ts
│   │   │   ├── poll.service.ts
│   │   │   ├── response.service.ts
│   │   │   └── analytics.service.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── schema.middleware.ts
│   │   │   ├── rateLimiter.middleware.ts
│   │   │   ├── error.middleware.ts
│   │   │   └── notFound.middleware.ts
│   │   └── validator/
│   │       ├── auth.validator.ts
│   │       ├── poll.validator.ts
│   │       └── response.validator.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── prisma.config.ts
│   ├── package.json
│   └── .env.example
├── AGENTS.md
├── consensus-prd.md
└── timeline.md
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- PostgreSQL running locally or remotely

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/ArmanRuhit/Consensus.git
cd Consensus

# 2. Install dependencies
cd server && npm install
cd ../client && npm install
cd ..

# 3. Configure environment
cp server/.env.example server/.env
# Edit server/.env — set DATABASE_URL and JWT_SECRET

# 4. Set up the database
cd server
npx prisma migrate dev
npx prisma generate
cd ..

# 5. Start the server (terminal 1)
cd server && npm run dev

# 6. Start the client (terminal 2)
cd client && npm run dev
```

Open `http://localhost:5173` in your browser.

### Environment Variables (`server/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `JWT_SECRET` | — | Secret key for signing JWTs |
| `CLIENT_URL` | `http://localhost:5173` | Base URL for poll share links |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | CORS origins (comma-separated) |
| `ALLOWED_METHODS` | `GET,POST,PUT,PATCH,DELETE` | CORS methods (comma-separated) |
| `RATE_LIMIT_WINDOW_MS` | `10000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | `1` | Max requests per window |

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | Public | Create account |
| POST | `/api/auth/login` | Public | Sign in (sets JWT cookie) |
| POST | `/api/auth/logout` | Required | Clear session |
| GET | `/api/auth/me` | Required | Get current user |
| POST | `/api/polls` | Required | Create a poll |
| GET | `/api/polls` | Required | List my polls |
| GET | `/api/polls/:shortId` | Public | Fetch poll (shape varies by state) |
| POST | `/api/polls/:shortId/responses` | Conditional | Submit response |
| POST | `/api/polls/:shortId/publish` | Creator | Publish results |
| POST | `/api/polls/:shortId/close` | Creator | Close poll early |
| GET | `/api/polls/:shortId/analytics` | Creator | Get analytics |
| GET | `/api/health` | Public | Health check |

Interactive API documentation is available at `/api-docs` when the server is running.

---

## Database Schema

Six tables: `User`, `Poll`, `Question`, `Option`, `Response`, `Answer`.

Key design decisions:
- **Cascade deletes** — deleting a user removes their polls, responses, etc.
- **Partial unique index** — `responses(poll_id, respondent_id)` enforced only when `respondent_id IS NOT NULL`, allowing anonymous responses without collisions
- **Order indexes** — `order_index` columns preserve creator-defined ordering
- **Lazy expiry** — composite index on `polls(state, expires_at)` supports efficient expiry checks

---

## Architecture Notes

### Poll Lifecycle

```
 ┌────────┐    close / expiry     ┌─────────┐    publish     ┌───────────┐
 │ ACTIVE │ ────────────────────→ │ EXPIRED │ ─────────────→ │ PUBLISHED │
 └────────┘                       └─────────┘                └───────────┘
```

- `ACTIVE` → form shown to respondents, responses accepted
- `EXPIRED` → "This poll has ended" shown, responses rejected
- `PUBLISHED` → results view with counts and percentages shown

### Lazy Expiry

Poll expiry is checked at request time — every fetch compares `expires_at` to `now()`. If expired, the state updates to `EXPIRED` in the database. No background scheduler needed.

### Real-Time Updates

Socket.io emits two events:
- `response:new` — broadcast to `poll:<shortId>` room when a response is submitted
- `poll:state` — broadcast when a poll is closed or published

The Dashboard joins all owned poll rooms on connect and updates response counts live.

### Auth Flow

JWT tokens are stored in httpOnly cookies (`sameSite: "lax"`, secure in production). The auth middleware reads from `req.cookies.token` — not the `Authorization` header. Authenticated-mode polls redirect unauthenticated users to login before showing the form.

### Rate Limiting

The response submission endpoint uses `express-rate-limit` with a custom key generator:
- Authenticated users are keyed by `userId`
- Anonymous users are keyed by IP address

---

## Scripts

### Server (`cd server`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled server |
| `npx prisma migrate dev` | Create & apply migrations |
| `npx prisma generate` | Regenerate Prisma client |

### Client (`cd client`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Typecheck + production build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

---

## Deployment

### Backend (Railway / Render)

1. Set the build command to `cd server && npm install && npm run build`
2. Set the start command to `cd server && node dist/index.js`
3. Configure environment variables in the dashboard

### Frontend (Vercel)

1. Set root directory to `client`
2. Build command: `npm run build`
3. Output directory: `dist`
4. Set `CLIENT_URL` in the server env to the deployed frontend URL

---

## License

MIT
