# luna-stellaria-api

Backend API for [Luna Stellaria](../luna-stellaria), hosted on **Cloudflare Workers** with **Hono** (chanfana OpenAPI layer).

The API owns everything server-side: accounts and sessions, the `lunadb` D1 database, and the hosted
Hugging Face endpoint used by the Indonesian AI text classifier. The frontend is a separate project
that calls this API directly with credentialed CORS.

- **Production domain:** `https://api.luna-stellaria.com`
- **Runtime:** Cloudflare Workers (`nodejs_compat`)
- **Framework:** Hono 4 + chanfana (OpenAPI generated from zod schemas)
- **Database:** Cloudflare D1 (`lunadb`)
- **Language:** TypeScript

## Endpoints

| Method | Path                     | Auth | Description                                 |
| ------ | ------------------------ | ---- | ------------------------------------------- |
| `GET`  | `/health`                | –    | Liveness/health check                       |
| `POST` | `/auth/register`         | –    | Create an account and start a session       |
| `POST` | `/auth/login`            | –    | Sign in and start a session                 |
| `POST` | `/auth/logout`           | –    | Clear the session cookie                    |
| `GET`  | `/auth/me`               | ✅   | Return the current user                     |
| `POST` | `/auth/account/name`     | ✅   | Change the account display name             |
| `POST` | `/auth/account/email`    | ✅   | Change email (requires current password)    |
| `POST` | `/auth/account/password` | ✅   | Change password (requires current password) |
| `POST` | `/ai/indobert/classify`  | ✅   | Classify Indonesian text via Hugging Face   |
| `GET`  | `/openapi.json`          | –    | Auto-generated OpenAPI spec                 |
| `GET`  | `/docs`                  | –    | Browsable API docs (Swagger UI)             |

### Request bodies

Request bodies are validated at runtime by the zod schemas in `src/routes/*.ts`; schema violations
(including malformed JSON) return `400 VALIDATION_ERROR` with details under `error.details`.

- `POST /auth/register` — `{ "email": string, "password": string, "confirm_password": string, "turnstile_token": string, "name"?: string }`
  (`name` is optional; when omitted a random pseudo name is generated. Users without one keep
  their email address as their account name.)
- `POST /auth/login` — `{ "email": string, "password": string, "turnstile_token": string }`
  (`turnstile_token` comes from the Cloudflare Turnstile widget and is verified server-side; without
  a valid token both endpoints fail with `400 TURNSTILE_FAILED`.)
- `POST /auth/account/name` — `{ "name": string }` (2–40 characters, unique)
- `POST /auth/account/email` — `{ "email": string, "current_password": string }` (reissues the session)
- `POST /auth/account/password` — `{ "current_password": string, "password": string, "confirm_password": string }`
- `POST /ai/indobert/classify` — `{ "text": string, "turnstile_token": string }`

### Response envelope

Every response uses one of two shapes:

```jsonc
// success
{ "success": true, "data": { /* ... */ } }

// failure
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Text cannot be empty." } }
```

Error `code` values include `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `NAME_TAKEN`,
`UNAUTHORIZED`, `TURNSTILE_FAILED`, `UPSTREAM_ERROR`, `INTERNAL_ERROR`, and `NOT_FOUND`. Unexpected
errors return `500` with an `INTERNAL_ERROR` envelope and are logged, never leaked to the client.

### Sessions

Sessions are a 7-day **HS256 JWT** stored in an httpOnly `jwt` cookie. In production the cookie is
scoped to `.luna-stellaria.com` so the frontend and API share it; locally it is host-only. Passwords
are hashed with `argon2` (default hardness). New accounts receive argon2 hashes immediately; existing bcrypt hashes are transparently rehashed to argon2 on next successful authentication (lazy migration, no password reset required). JWTs are signed and verified with `jose`.

Authenticated endpoints resolve the `jwt` cookie via the `requireAuth` helper
(`src/middleware/auth.ts`), which throws `401 UNAUTHORIZED` when the session is missing or invalid.
Cookie scoping is decided by the request URL scheme, not the hostname: HTTPS requests get
`Secure` + `Domain=.luna-stellaria.com`; plain-HTTP local development gets a host-only,
non-secure cookie (`wrangler dev` rewrites `Host`, so it must never be branched on).

### Turnstile

`/auth/register`, `/auth/login`, and `/ai/indobert/classify` are protected by
[Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/).
The frontend renders the widget with the public site key and posts the solved token as
`turnstile_token`; the token is a validated zod body field checked inside the endpoint
(`cf-connecting-ip` is forwarded as `remoteip`) with the `Turnstile_secret_key` secret against the
siteverify endpoint (`src/services/turnstile.service.ts`).
Missing or rejected tokens fail with `400 TURNSTILE_FAILED`; if Cloudflare siteverify is unreachable
the request fails with `502 UPSTREAM_ERROR`. Tokens are single-use, so the frontend resets the widget
after every failed submission.

### CORS

Credentialed CORS is handled in `src/middleware/cors.ts`. Allowed origins are
`https://luna-stellaria.com` and `https://www.luna-stellaria.com`, any other HTTPS host inside the
`luna-stellaria.com` zone (including version previews like `<preview>.preview.luna-stellaria.com`),
plus any `http://localhost` / `http://127.0.0.1` origin for local development. The allowed origin is
echoed back (never `*`) with `Access-Control-Allow-Credentials: true`. `OPTIONS` preflight requests
return `204`.

## Project Structure

```text
src/
├── index.ts                 Cloudflare Workers entry point (export default Hono app)
├── app.ts                   Hono app factory: middleware, onError/notFound, OpenAPI registry
├── env.d.ts                 Typed Worker secrets (JWT_SECRET, Turnstile_secret_key, hf_endpoints, hf_endpoints_key)
├── routes/                  chanfana OpenAPIRoute endpoints (zod schemas) + fromHono registry
├── services/                Business logic (auth, indobert, turnstile)
├── models/                  D1 data access (user)
├── middleware/              Credentialed CORS, requireAuth helper, HttpError + envelope renderers
├── utils/                   Session-cookie helpers (hono/cookie)
└── types/                   Shared API types (envelope, AppEnv)
migrations/                  D1 SQL migrations (numbered)
wrangler.jsonc               Worker config (domain route, D1 binding)
```

The OpenAPI spec (`/openapi.json`) and Swagger UI (`/docs`) are generated from the zod
request/response schemas in `src/routes/*.ts`. Registering a new `OpenAPIRoute` endpoint in
`src/routes/index.ts` automatically documents it.

## Getting Started

### Prerequisites

- Node.js 20+
- A [Cloudflare account](https://dash.cloudflare.com/) with a D1 database named `lunadb`

### Install

```bash
npm install
```

### Configure Environment

Copy `.dev.vars.example` to `.dev.vars` (gitignored) and fill in the values:

```text
JWT_SECRET="replace-with-a-long-random-string"
hf_endpoints="https://your-endpoint.huggingface.cloud"
hf_endpoints_key="hf_replace_me"
Turnstile_secret_key="replace-with-your-turnstile-secret-key"
```

| Variable               | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `JWT_SECRET`           | Signs and verifies session JWTs                     |
| `hf_endpoints`         | Hosted Hugging Face inference endpoint for IndoBERT |
| `hf_endpoints_key`     | Hugging Face API token for that endpoint            |
| `Turnstile_secret_key` | Server key for verifying Turnstile form tokens      |

`.dev.vars` is only read by `wrangler dev`; `npm run gen`/`typecheck` do not need it.

Besides the secrets, `ENVIRONMENT` marks the deployment tier: `"development"` locally (from
`.dev.vars`), `"production"` at top level in `wrangler.jsonc`, and `"preview"` in its `previews`
block.

### Database

Apply the migrations to D1:

```bash
npx wrangler d1 migrations apply lunadb --local    # local dev
npx wrangler d1 migrations apply lunadb --remote   # production
```

Never edit an applied migration — add a new numbered file (`0003_...`) instead. The `users` table
(`0001_create-auth.sql`, extended by `0002_add-display-name.sql`) holds `id`, `email` (unique),
`display_name` (unique account name), `password_hash`, and `created_at`.

### Run Locally

```bash
npm run dev
```

`wrangler dev` serves the API on `http://localhost:8787` by default, which is the URL the frontend's
`src/lib/api.ts` uses for localhost.

## Scripts

| Script              | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Run the API locally with `wrangler dev`              |
| `npm run build`     | Generate types + `tsc --noEmit` (type check)         |
| `npm run typecheck` | `tsc --noEmit`                                       |
| `npm run lint`      | Run Prettier and ESLint                              |
| `npm run format`    | Format code with Prettier                            |
| `npm run gen`       | Regenerate `worker-configuration.d.ts`               |
| `npm run deploy`    | Generate types, format, build, and `wrangler deploy` |

## Deployment

```bash
npm run deploy
```

The Worker is bound to `api.luna-stellaria.com` via the `routes` entry in `wrangler.jsonc`
(`custom_domain: true`) and to the `lunadb` D1 database via the `d1_databases` binding. The domain's
zone must be in the same Cloudflare account or `wrangler deploy` fails.

Set the secrets in production (they are never committed):

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put hf_endpoints
npx wrangler secret put hf_endpoints_key
npx wrangler secret put Turnstile_secret_key
```

Run the production migrations with `npx wrangler d1 migrations apply lunadb --remote`.

### Environments

| Environment | How it runs                                                                                          | Config                                               |
| ----------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Development | `npm run dev` (`wrangler dev`, `http://localhost:8787`)                                              | `.dev.vars` (template in `.dev.vars.example`)        |
| Preview     | `npx wrangler preview` — isolated copy per branch at `<preview-name>.preview-api.luna-stellaria.com` | `previews` block in `wrangler.jsonc`                 |
| Production  | `npm run deploy` → `https://api.luna-stellaria.com`                                                  | top-level `vars`, `d1_databases` in `wrangler.jsonc` |

Preview setup (once, Wrangler 4.135+; `deploy` must have run at least once):

```bash
# Isolated preview database; paste the returned ID into the previews block:
npx wrangler d1 create lunadb-preview

# `d1 migrations apply` only resolves databases declared in the top-level
# config, so apply each migration file in numeric order with `d1 execute`:
npx wrangler d1 execute lunadb-preview --remote --file migrations/0001_create-auth.sql
npx wrangler d1 execute lunadb-preview --remote --file migrations/0002_add-display-name.sql

# Shared secrets for every new preview:
npx wrangler preview base-config secret put JWT_SECRET
npx wrangler preview base-config secret put hf_endpoints
npx wrangler preview base-config secret put hf_endpoints_key
npx wrangler preview base-config secret put Turnstile_secret_key
# For Turnstile, the always-passing test key 1x0000000000000000000000000000000AA
# is a safe default; use a real preview key if you want real checks.
```

Each preview keeps users out of the production database; previews of the frontend (`luna-stellaria`)
resolve to the API preview of the same preview name automatically.
