# Product Requirements Document: Consensus

**Version:** 1.1
**Date:** May 11, 2026
**Author:** Arman Ruhit
**Status:** Draft — Hackathon Submission

---

## 1. Overview

### 1.1 Product Summary

Consensus is a full-stack polling platform that lets authenticated users create polls, share them via public links, collect responses from anonymous or authenticated respondents, and view live analytics as responses come in. Once a poll concludes, creators can publish results so the same public link displays the final outcome to anyone who visits.

### 1.2 Problem Statement

Existing polling tools fall into two camps: heavyweight survey suites (Typeform, SurveyMonkey) that are overkill for quick decisions, or oversimplified tools (Strawpoll) that lack analytics, authentication options, and lifecycle controls like expiry and result publishing. Teams, classrooms, and communities need a lightweight middle ground that handles the full lifecycle — create, collect, analyze, publish — with real-time visibility into incoming responses.

### 1.3 Goals

- Let a creator build and share a poll in under 60 seconds.
- Support both anonymous and authenticated response modes per poll.
- Enforce poll expiry automatically with no further responses accepted past the deadline.
- Surface response data live via WebSockets so creators see counts update without refreshing.
- Allow creators to publish final results to the same public link after the poll closes.

### 1.4 Non-Goals (v1)

- Multi-select questions, ranked choice, open-ended text answers, or file uploads.
- Conditional branching, question logic, or skip patterns.
- Email invitations, reminders, or scheduled sends.
- Team workspaces, role-based access, or multi-creator polls.
- Payment, plans, or quotas.
- Mobile native apps.

---

## 2. Target Users & Use Cases

### 2.1 Personas

**Creator (authenticated user).** Wants to ask a question to a group, gather answers quickly, and see results clearly.

**Respondent (authenticated or anonymous).** Receives a link, opens it, answers, submits. Wants the experience to be fast and frictionless.

**Public viewer (post-publish).** Visits the same link after results are published and sees the final outcome. No login required.

### 2.2 Primary Use Cases

1. A creator drafts a 3-question poll, sets a 24-hour expiry and anonymous mode, and shares the link in Slack.
2. Respondents click the link, answer the mandatory questions (one optional question skipped), and submit.
3. The creator watches live response counts climb on the dashboard.
4. The poll expires; the creator reviews the analytics and clicks "Publish Results."
5. New visitors to the same link now see published results instead of the form.

---

## 3. Functional Requirements

### 3.1 Authentication

- Email + password signup and login. Hashed passwords (bcrypt or argon2).
- JWT-based session tokens stored in httpOnly cookies.
- Protected routes: poll creation, dashboard, analytics, publish action.
- Public routes: poll-taking page, published-results page, login/signup.

### 3.2 Poll Creation

A logged-in creator builds a poll with:

- **Title** (required, max 200 chars).
- **Description** (optional, max 1000 chars).
- **Questions** — one or more, each with:
  - Question text (required, max 500 chars).
  - 2 to 10 options (text, max 200 chars each).
  - Mandatory or optional flag.
- **Response mode** — `anonymous` or `authenticated`. In authenticated mode, respondents must be logged in and each user can respond once.
- **Expiry timestamp** — required, must be in the future.
- Each poll receives a unique short ID used in the public URL (e.g. `/p/aB3xK9`).

Validation runs on both client and server. The backend re-validates everything on POST and rejects malformed payloads.

### 3.3 Poll Lifecycle States

| State | Meaning | Public link behavior |
|---|---|---|
| `active` | Created, before expiry | Shows the form; accepts responses |
| `expired` | Past expiry, not yet published | Shows "This poll has ended"; rejects new responses |
| `published` | Creator published results | Shows results summary to anyone |

State transitions: `active → expired` happens automatically (lazy evaluation at request time, comparing `expires_at` to `now()`). `expired → published` happens when the creator clicks publish. Creators can also manually close a poll early.

### 3.4 Taking a Poll

- Anyone with the link can open it. Frontend fetches poll metadata and renders the form.
- Single-option-per-question selection only (radio buttons).
- Mandatory questions block submission if unanswered; optional ones do not.
- Submit calls the backend, which re-validates required questions, verifies the poll is `active`, and records the response.
- Response submission is rate-limited. Anonymous respondents are throttled by IP; authenticated respondents by user ID. A reasonable default is 1 submission per 10 seconds per poll, configurable via environment variable.
- In authenticated mode, the API checks the JWT and rejects duplicate submissions from the same user.
- In anonymous mode, the API stores no respondent identifier.
- On success, the respondent sees a confirmation screen.

### 3.5 Analytics Dashboard (Creator-only)

Reachable from `/dashboard` and `/polls/:id/analytics`. Shows:

- Total response count.
- Per-question summary: option labels, count per option, percentage bar.
- Participation rate for optional questions.
- Poll metadata (created at, expires at, mode, state).
- A live indicator that updates the counts in real time as responses arrive.

### 3.6 Real-Time Updates

- Socket.io connection established when the creator opens their analytics page.
- Server emits a `response:new` event scoped to the poll's room (`poll:<pollId>`) when a new response is recorded.
- Payload includes incremented totals and per-option deltas so the client can patch state without a full refetch.

### 3.7 Publishing Results

- Available to the creator once the poll is `expired` (or manually closed).
- Clicking publish flips the state to `published`.
- Once published, the public URL `/p/:shortId` renders a read-only results view: question text, options, counts, percentages, total participants.
- A published poll cannot be unpublished in v1.

---

## 4. Non-Functional Requirements

- **Performance.** Poll-taking page loads in under 1 second on a typical connection. Analytics updates reach the client in under 1 second of a response being submitted.
- **Validation.** All inputs validated on the backend regardless of frontend state. Backend is the source of truth.
- **Security.** Hashed passwords, signed JWTs, CORS configured for the deployed frontend origin only. Rate-limiting is enforced on all response submission endpoints — anonymous respondents are throttled by IP address, authenticated respondents by user ID, to prevent ballot-stuffing and abuse.
- **Reliability.** Expired polls must reject responses even if the cron/scheduler is down — enforce at the API layer.
- **Accessibility.** Forms use proper labels, keyboard navigation works, focus states visible.

---

## 5. Technical Architecture

### 5.1 Stack

- **Frontend:** React (Vite), TypeScript, Tailwind CSS, React Router, Socket.io-client, React Hook Form + Zod, Orval (OpenAPI client codegen).
- **Backend:** Node.js + Express, Socket.io, JWT, bcrypt, Zod, Swagger UI.
- **API Documentation:** OpenAPI 3.x spec (manually maintained), served via Swagger UI, used for frontend client generation (Orval).
- **Database:** PostgreSQL via Prisma.
- **Deployment:** Frontend on Vercel; backend + database on Railway or Render.
- **Repo:** Single monorepo with `/client` and `/server` directories.

### 5.2 Database Schema (ChartDB DBML)

Paste the following directly into ChartDB → Import → DBML to generate the diagram. The schema is also rendered as a description below for clarity.

```dbml
// Consensus — poll platform schema

Table users {
  id            uuid       [pk, default: `gen_random_uuid()`]
  email         varchar    [not null, unique]
  password_hash varchar    [not null]
  name          varchar
  created_at    timestamptz [not null, default: `now()`]

  indexes {
    email [unique]
  }
}

Table polls {
  id            uuid       [pk, default: `gen_random_uuid()`]
  short_id      varchar(12) [not null, unique]
  creator_id    uuid       [not null, ref: > users.id, rel: m2o, onDelete: cascade]
  title         varchar(200) [not null]
  description   varchar(1000)
  response_mode poll_response_mode [not null]
  state         poll_state [not null, default: 'active']
  expires_at    timestamptz [not null]
  published_at  timestamptz
  created_at    timestamptz [not null, default: `now()`]

  indexes {
    short_id [unique]
    creator_id
    (state, expires_at)
  }
}

Table questions {
  id           uuid       [pk, default: `gen_random_uuid()`]
  poll_id      uuid       [not null, ref: > polls.id, rel: m2o, onDelete: cascade]
  text         varchar(500) [not null]
  is_mandatory boolean    [not null, default: false]
  order_index  int        [not null]

  indexes {
    (poll_id, order_index) [unique]
  }
}

Table options {
  id          uuid       [pk, default: `gen_random_uuid()`]
  question_id uuid       [not null, ref: > questions.id, rel: m2o, onDelete: cascade]
  text        varchar(200) [not null]
  order_index int        [not null]

  indexes {
    (question_id, order_index) [unique]
  }
}

Table responses {
  id            uuid       [pk, default: `gen_random_uuid()`]
  poll_id       uuid       [not null, ref: > polls.id, rel: m2o, onDelete: cascade]
  respondent_id uuid       [ref: > users.id, rel: m2o, note: 'null = anonymous']
  submitted_at  timestamptz [not null, default: `now()`]

  indexes {
    poll_id
    (poll_id, respondent_id) [unique, note: 'enforced only when respondent_id is not null']
  }
}

Table answers {
  id                  uuid [pk, default: `gen_random_uuid()`]
  response_id         uuid [not null, ref: > responses.id, rel: m2o, onDelete: cascade]
  question_id         uuid [not null, ref: > questions.id, rel: m2o]
  selected_option_id  uuid [ref: > options.id, rel: m2o, note: 'null = skipped optional question']

  indexes {
    response_id
    question_id
    selected_option_id
  }
}

Enum poll_response_mode {
  anonymous
  authenticated
}

Enum poll_state {
  active
  expired
  published
}
```

### 5.3 Schema Notes

**Relationship types:**
- `m2o` = Many-to-One (foreign key with `onDelete: cascade` unless noted)
- All relations use `ref: > parent.id` syntax to define foreign key references

**Cascade delete chain:**
- `polls.creator_id → users.id` — if a user is deleted, their polls are deleted
- `questions.poll_id → polls.id` — if a poll is deleted, its questions are deleted
- `options.question_id → questions.id` — if a question is deleted, its options are deleted
- `responses.poll_id → polls.id` — if a poll is deleted, its responses are deleted
- `answers.response_id → responses.id` — if a response is deleted, its answers are deleted

**Nullable relationships:**
- `responses.respondent_id → users.id` — null means anonymous response (no user required)
- `answers.selected_option_id → options.id` — null means optional question was skipped

**Partial unique index:** on `responses(poll_id, respondent_id)` should be enforced in SQL as `WHERE respondent_id IS NOT NULL` so anonymous responses don't collide on the null value.

**`order_index`** columns preserve creator-defined question/option order without depending on insertion timestamps.

**Expiry check:** The composite index on `polls(state, expires_at)` supports the lazy expiry check on every poll fetch.

### 5.4 API Documentation

An OpenAPI 3.x specification will document all public backend endpoints. The spec will be served alongside the app and used to auto-generate the frontend API client (e.g. via Orval).

- **Tooling:** Swagger UI for interactive docs, OpenAPI JSON file for codegen.
- **Coverage:** All endpoints listed below, including request bodies, response shapes, and error codes.
- **Generation:** Spec is maintained manually (not auto-generated from code) to keep tight control over schemas shared with the frontend.

### 5.5 Key API Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/signup` | public | Create account |
| POST | `/api/auth/login` | public | Issue JWT cookie |
| POST | `/api/auth/logout` | required | Clear cookie |
| GET | `/api/auth/me` | required | Current user |
| POST | `/api/polls` | required | Create poll |
| GET | `/api/polls/mine` | required | List creator's polls |
| GET | `/api/polls/:shortId` | public | Fetch poll (form or results view depending on state) |
| POST | `/api/polls/:shortId/responses` | conditional | Submit response |
| GET | `/api/polls/:id/analytics` | required (creator) | Aggregated analytics |
| POST | `/api/polls/:id/publish` | required (creator) | Publish results |
| POST | `/api/polls/:id/close` | required (creator) | Manually expire early |

### 5.6 Real-Time Channel

Single Socket.io namespace. Rooms keyed by poll ID. Server joins the creator's socket to `poll:<id>` when they open analytics; emits `response:new` on every successful submission.

---

## 6. Request / Response Templates

These are the canonical shapes the API should accept and produce. Use them as the source of truth when wiring up Zod schemas, Postman collections, and frontend types.

### 6.1 Signup

**Request:** `POST /api/auth/signup`
```json
{
  "email": "creator@example.com",
  "password": "correct-horse-battery",
  "name": "Arman Ruhit"
}
```
**Response 201:**
```json
{
  "user": { "id": "uuid", "email": "creator@example.com", "name": "Arman Ruhit" }
}
```
**Errors:** 400 (validation), 409 (email exists).

### 6.2 Login

**Request:** `POST /api/auth/login`
```json
{ "email": "creator@example.com", "password": "correct-horse-battery" }
```
**Response 200:** sets httpOnly cookie; body returns same shape as signup.
**Errors:** 401 (bad credentials).

### 6.3 Create Poll

**Request:** `POST /api/polls`
```json
{
  "title": "Where should we hold the team offsite?",
  "description": "Pick your top venue. Closes Friday.",
  "responseMode": "anonymous",
  "expiresAt": "2026-05-16T17:00:00Z",
  "questions": [
    {
      "text": "Which city?",
      "isMandatory": true,
      "options": [
        { "text": "Cox's Bazar" },
        { "text": "Sylhet" },
        { "text": "Bandarban" }
      ]
    },
    {
      "text": "Any dietary preference we should know about?",
      "isMandatory": false,
      "options": [
        { "text": "Veg" },
        { "text": "Non-veg" },
        { "text": "Anything works" }
      ]
    }
  ]
}
```
**Response 201:**
```json
{ "id": "uuid", "shortId": "aB3xK9", "url": "https://consensus.app/p/aB3xK9" }
```
**Errors:** 400 (validation: missing fields, <2 options, expiry in past, etc.), 401.

### 6.4 Fetch Poll (public)

**Request:** `GET /api/polls/aB3xK9`

**Response 200 (active):**
```json
{
  "shortId": "aB3xK9",
  "state": "active",
  "title": "Where should we hold the team offsite?",
  "description": "Pick your top venue. Closes Friday.",
  "responseMode": "anonymous",
  "expiresAt": "2026-05-16T17:00:00Z",
  "questions": [
    {
      "id": "q-uuid-1",
      "text": "Which city?",
      "isMandatory": true,
      "options": [
        { "id": "o-uuid-1", "text": "Cox's Bazar" },
        { "id": "o-uuid-2", "text": "Sylhet" },
        { "id": "o-uuid-3", "text": "Bandarban" }
      ]
    }
  ]
}
```

**Response 200 (expired, not published):** `state: "expired"`, no question/option payload (or same payload, frontend chooses what to render based on state).

**Response 200 (published):** `state: "published"`, response payload includes results inline:
```json
{
  "shortId": "aB3xK9",
  "state": "published",
  "title": "Where should we hold the team offsite?",
  "totalResponses": 47,
  "questions": [
    {
      "id": "q-uuid-1",
      "text": "Which city?",
      "totalAnswered": 47,
      "options": [
        { "id": "o-uuid-1", "text": "Cox's Bazar", "count": 22, "percentage": 46.8 },
        { "id": "o-uuid-2", "text": "Sylhet", "count": 15, "percentage": 31.9 },
        { "id": "o-uuid-3", "text": "Bandarban", "count": 10, "percentage": 21.3 }
      ]
    }
  ]
}
```

### 6.5 Submit Response

**Request:** `POST /api/polls/aB3xK9/responses`
```json
{
  "answers": [
    { "questionId": "q-uuid-1", "selectedOptionId": "o-uuid-2" },
    { "questionId": "q-uuid-2", "selectedOptionId": null }
  ]
}
```
**Response 201:** `{ "ok": true }`
**Errors:** 400 (missing mandatory answer, invalid option for question), 401 (authenticated mode, not logged in), 409 (already responded), 410 (poll expired), 429 (rate limit exceeded).

### 6.6 Analytics

**Request:** `GET /api/polls/:id/analytics` (creator only)

**Response 200:**
```json
{
  "pollId": "uuid",
  "shortId": "aB3xK9",
  "state": "active",
  "totalResponses": 12,
  "questions": [
    {
      "id": "q-uuid-1",
      "text": "Which city?",
      "isMandatory": true,
      "totalAnswered": 12,
      "options": [
        { "id": "o-uuid-1", "text": "Cox's Bazar", "count": 5 },
        { "id": "o-uuid-2", "text": "Sylhet", "count": 4 },
        { "id": "o-uuid-3", "text": "Bandarban", "count": 3 }
      ]
    },
    {
      "id": "q-uuid-2",
      "text": "Any dietary preference we should know about?",
      "isMandatory": false,
      "totalAnswered": 9,
      "participationRate": 0.75,
      "options": [
        { "id": "o-uuid-4", "text": "Veg", "count": 2 },
        { "id": "o-uuid-5", "text": "Non-veg", "count": 4 },
        { "id": "o-uuid-6", "text": "Anything works", "count": 3 }
      ]
    }
  ]
}
```

### 6.7 Socket.io `response:new` Event Payload

Emitted to room `poll:<pollId>` on every successful response insert:
```json
{
  "pollId": "uuid",
  "totalResponses": 13,
  "deltas": [
    { "questionId": "q-uuid-1", "optionId": "o-uuid-2", "newCount": 5 },
    { "questionId": "q-uuid-2", "optionId": "o-uuid-5", "newCount": 5 }
  ]
}
```
Client patches state by incrementing `totalResponses` and replacing matching option counts. Skipped optional questions don't appear in `deltas`.

---

## 7. User Flows

**Create flow.** Login → Dashboard → "New Poll" → fill form → submit → land on share screen with copyable link and QR code.

**Respond flow (anonymous).** Open link → see form → answer → submit → confirmation screen.

**Respond flow (authenticated).** Open link → prompted to log in if not already → see form → submit → confirmation screen. Returning to the link shows "you've already responded."

**Analytics flow.** Dashboard → click poll → see live analytics → watch counts tick up.

**Publish flow.** Poll expires → creator opens analytics → "Publish Results" button → confirm → public link now shows results page.

---

## 8. Acceptance Criteria

A submission is considered complete when:

1. A new user can sign up, log in, create a poll with at least 3 questions (mix of mandatory/optional), and share the link.
2. Both anonymous and authenticated response modes work end-to-end.
3. Submitting a response after `expires_at` fails with a clear error (410), even on a freshly-opened link.
4. Mandatory questions cannot be skipped; optional ones can.
5. The creator's analytics dashboard updates live (visibly within 1–2 seconds) as responses are submitted from another browser.
6. The creator can publish results, after which the public link renders the results view instead of the form.
7. Repo is public on GitHub with `/client` and `/server`, a working README covering setup and deploy, and a live deployed URL.

---

## 9. Open Questions & Stretch Goals

- Show live response count on the public poll page, not just the dashboard.
- Anonymous duplicate-suppression — hashed IP + user-agent fingerprint.
- Export results as CSV.
- Dark mode.
- Auto-generate OpenAPI spec from code (currently maintained manually).
- Poll templates as quick starts.

---

## 10. Out of Scope (Explicit)

Multi-select, ranked-choice, text/open-ended answers, conditional logic, team workspaces, billing, mobile apps, email notifications, password reset flow (stretch if time permits).