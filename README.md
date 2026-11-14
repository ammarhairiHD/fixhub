# FixHub@uitm

FixHub@uitm is a responsive prototype for reporting and tracking UiTM campus maintenance faults. The database schema, synthetic local sample data, and UC-01 authentication workflows are implemented. Request reporting and maintenance workflows remain future phases.

## Requirements

- Node.js 22 or newer and npm 10 or newer
- A Cloudflare account for deployment
- Wrangler login for remote database setup and deployment

## First-time setup

1. Install dependencies from the repository root:

   ```sh
   npm install
   ```

2. Log in to Cloudflare:

   ```sh
   npx wrangler login
   ```

3. Create the production D1 database and R2 bucket:

   ```sh
   npx wrangler d1 create fixhub-db --config backend/wrangler.jsonc
   npx wrangler r2 bucket create fixhub-photos
   ```

4. Copy the returned D1 `database_id` into `backend/wrangler.jsonc` in place of `00000000-0000-0000-0000-000000000000`. The R2 bucket name is already configured as `fixhub-photos`; change it in `backend/wrangler.jsonc` if you chose a different name.

5. Copy `backend/.dev.vars.example` to `backend/.dev.vars` for local development if needed. Do not put secrets in frontend files or commit `.dev.vars`.

## Run locally

Start the Worker API and Vite frontend together:

```sh
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). The frontend sends `/api` requests to the local backend on port `8787`; `/health` checks the API and `/login` is the authentication entry point. The local Worker uses local development bindings and does not require the production D1 database ID, R2 bucket, or Workers AI service.

## Database migrations and local sample data

SQL migrations live in `backend/migrations/` and are generated from `backend/src/db/schema.ts`. Apply them locally with:

```sh
npm run db:migrate:local
```

After updating the Drizzle schema, generate a migration with:

```sh
npm run db:generate --workspace=backend
```

Review generated SQL before applying it. Apply migrations to the production database only when ready:

```sh
npm run db:migrate:remote
```

Seed only the local D1 database with dummy accounts, 50 sample locations and 300 sample requests:

```sh
npm run db:seed
```

Seed accounts use `seed.admin@uitm.edu.my`, `seed.technician01@uitm.edu.my` through `seed.technician03@uitm.edu.my`, and `seed.reporter01@student.uitm.edu.my` through `seed.reporter05@student.uitm.edu.my`. Their shared password is `Password123`; staff accounts require a password change on first login. These are synthetic accounts, and the script stores only PBKDF2-SHA256 hashes with individual salts. The seed is repeatable and does not create sessions or photos.

The seed leaves `requests.embedding` null. Once Cloudflare API credentials are available in `backend/.dev.vars`, backfill a batch of embeddings using Workers AI `@cf/baai/bge-m3`:

```sh
npm run db:backfill-embeddings
```

The backfill defaults to 10 requests per run; set `EMBEDDING_BATCH_SIZE` to a value from 1 to 50 to adjust it. It sends only request descriptions to the embedding model and updates the local D1 database.

## Build, test, and deploy

```sh
npm run build
npm test
npm run deploy
```

Deployment publishes the API Worker first, then builds and publishes the frontend Worker. The frontend routes `/api/*` to `fixhub-api` using its `API` service binding and serves the built single-page application for other paths.
