# FixHub@uitm – Project rules for Claude

FixHub@uitm is a web prototype for reporting and tracking UiTM campus maintenance faults (CSC577 Group E).
The approved SRS is in /docs. Requirement IDs (FR-xx, NFR-xx, UC-xx, OI-xx) are stable: use them in code comments,
commit messages and test names (e.g. `fr27: rejects Submitted -> Completed`). Never change a business rule or value
below without being told; if a requirement looks wrong or impossible on Cloudflare, say so instead of improvising.

## Monorepo
npm workspaces with two packages: `frontend/` and `backend/`. Root scripts: dev (runs both), test, build, deploy.
Shared code lives in backend/src/shared (enums, constants, Zod schemas, API types). The frontend imports it through the
TypeScript/Vite path alias `@shared` → ../backend/src/shared. Shared code must have no Worker or React dependencies.

## Platform: Cloudflare free plan
- backend/: Cloudflare Worker "fixhub-api". Hono + TypeScript + Zod (@hono/zod-validator). All routes under /api.
  NOT Express, NOT Node-only packages. Prefer Web APIs (fetch, crypto.subtle).
  Bindings: D1 (DB), R2 (PHOTOS), Workers AI (AI). Daily Cron Trigger → scheduled() for auto-close (FR-33) and email retries (FR-29).
  DB access with Drizzle ORM; migrations with drizzle-kit in backend/migrations.
- frontend/: React + Vite + TypeScript + Tailwind + React Router + TanStack Query + Recharts.
  Deployed as Worker "fixhub-web" with static assets (SPA fallback to index.html) and a tiny Worker script that forwards
  /api/* to fixhub-api through a Service Binding (binding name API), so the browser only sees ONE origin.
  Local dev: Vite dev server proxies /api → http://localhost:8787 (wrangler dev of the backend).
- AI: Workers AI. Classifier `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (var AI_CLASSIFIER_MODEL; alternative
  `@cf/meta/llama-3.1-8b-instruct-fp8-fast`). Embeddings `@cf/baai/bge-m3`.
- Email: EmailService interface with providers "console" (default, logs) and "http" (outside email API via fetch,
  secret EMAIL_API_KEY). In-app notification is ALWAYS created; email is best-effort.
- Free-plan limits: 10 ms CPU per request (I/O waits don't count), KV 1,000 writes/day (don't use KV),
  Workers AI 10,000 neurons/day (mock env.AI in automated tests).
- Secrets via `wrangler secret put` / backend/.dev.vars (never committed; provide .dev.vars.example). No secrets in the frontend bundle.
- Tests: backend Vitest + @cloudflare/vitest-pool-workers; frontend Vitest + Testing Library.

## Folder layout
backend/src/{index.ts (Hono app + scheduled), routes/, middleware/, services/, ai/, db/schema.ts, shared/}
backend/{migrations/, seed/, data/ (locations_seed.json, keyword_rules.json, labelled_reports.csv, duplicate_pairs.csv), scripts/, wrangler.jsonc}
frontend/src/{pages/, components/, api/, hooks/, routes.tsx}   frontend/worker/index.ts (API proxy)   frontend/wrangler.jsonc

## Roles and access (FR-05, NFR-04) – enforce in the backend on EVERY route
REPORTER (self-registers) · ADMIN · TECHNICIAN (both created by ADMIN).
Reporter: own requests + followed requests only. Technician: assigned requests only. Admin: all.
Not logged in → 401. Wrong role / not owner → 403. Never leak data in error bodies. Frontend route guards are only for UX.

## Enums (exact strings, in backend/src/shared/enums.ts)
Category: Electrical | Plumbing and Water | Air-conditioning | Furniture and Civil | ICT/AV Equipment | Cleanliness | Others
Priority: Critical | High | Medium | Low   (sort Critical > High > Medium > Low)
Status: Submitted | Verified | Assigned | In Progress | Completed | Closed | Rejected | Cancelled
LocationType: Academic | Residential | Common area
AiSource: ai | keyword | manual      RemarkVisibility: reporter | staff

## Status transitions (FR-27) – ONE function in backend/src/services/status.ts; anything else → 409
Submitted→Verified (admin) | Submitted→Rejected (admin, reason required) | Submitted→Cancelled (owner reporter)
Verified→Assigned (admin, ACTIVE technician) | Assigned/In Progress→Assigned (admin reassign)
Assigned→In Progress (assigned technician) | In Progress→Completed (assigned technician, remark ≥10 chars)
Completed→Closed (owner confirm, or cron auto-close after 7 days) | Completed→Verified (owner reopen ≤7 days, reason ≥10, reopen_count+1)
Each change: write status_history + notify reporter and followers. The AI module must never call this function (NFR-14).

## Fixed values (backend/src/shared/constants.ts – no magic numbers elsewhere)
EMAIL_DOMAINS ["@uitm.edu.my","@student.uitm.edu.my"] · PASSWORD_MIN 8 · LOCK_AFTER 5 · LOCK_MINUTES 15 · IDLE_TIMEOUT_MIN 30
DESC_MIN 10 · DESC_MAX 500 · PHOTO_MAX_BYTES 5 MB · PHOTO_TYPES jpeg/png (check MIME + magic bytes + size) · 1 report + 1 completion photo
AI_CONFIDENCE_MIN 0.50 · SIMILARITY_MIN 0.75 · SIMILAR_MAX_SHOWN 3 · SIMILAR_COMPARE_MAX 50 · AI_TIMEOUT_MS 5000
CONFIRM_WINDOW_DAYS 7 · REMARK_MIN 10 · RATING 1–5 · COMMENT_MAX 300 · OVERDUE_HOURS 24 · OVERDUE_CRITICAL_HOURS 2
HOTSPOT_MIN 3 in 30 days · reference FH-YYYY-NNNN (per-year sequence) · EMAIL_RETRIES 3

## Auth
Passwords: PBKDF2-SHA256 via crypto.subtle, random 16-byte salt, iterations stored with the hash.
Measure login CPU and tune iterations to fit the free-plan limit; record the value in docs/security-notes.md (NFR-10).
Sessions: random 32-byte token in an HttpOnly, Secure, SameSite=Lax cookie (Path=/); sessions table in D1 with last_seen (30-min idle timeout).

## AI rules
- Send ONLY description, location_type, keywords to Workers AI (NFR-05). Log the payload in dev.
- Classifier prompt lists the allowed categories/priorities and asks for JSON {category, priority, confidence}; validate with Zod.
  Invalid / confidence < 0.50 → "Not sure, please choose" (fields empty).
  Error or > 5 s (Promise.race timeout) → keyword rules ("Suggested by keyword rules") → no match → manual (FR-16–18).
- Safety keywords force Critical + safety warning, overriding the model (FR-19, NFR-13). Resource-wasting keywords set resource_wasting (FR-53).
- Save an ai_suggestions row per request: suggested category/priority, confidence, source, overridden, model, response_ms (FR-20).
- Embeddings: bge-m3 once per request on create, stored in D1. Duplicate check: ≤50 most recent open requests in the same building,
  cosine similarity in the Worker. Thresholds are provisional (OI-03).
- AI code sits behind interfaces (Classifier, Embedder) so another provider can be swapped in by config.

## Data integrity
Requests never deleted (end states Closed/Rejected/Cancelled); users and locations are deactivated, not deleted.
Request creation = one D1 batch (request + ai_suggestion + history + photo record) (NFR-11); if the R2 upload succeeded but the batch fails,
delete the R2 object. Email failure never rolls back a status change (FR-29).

## UI rules
English UI; Malay/English/mixed input stored exactly as typed (NFR-08). Responsive from 360 px, no horizontal scroll (NFR-06).
Status and priority always as TEXT badges; labels on all fields; contrast ≥ 4.5:1; tap targets ≥ 44 px (NFR-12).
Field-level errors that keep user input; confirmations show the reference number.
Exact SRS messages: "Not sure, please choose", "Suggested by keyword rules", "Similar-request check is unavailable",
"Incorrect email or password", "Account inactive", "No requests match", "Overdue", "You are already following this request",
"No data for the selected period". Never promise a repair or response time (NFR-13).

## Working style
One phase at a time. After each phase: run tests, list FR/NFR IDs now covered and anything skipped or uncertain.
Small functions, strict TypeScript, no `any`, no unused dependencies.