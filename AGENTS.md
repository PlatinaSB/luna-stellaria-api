# AGENTS.md

## Project Overview

This project is a TypeScript-based HTTP API hosted on **Cloudflare Workers**, using **Hono** as its web framework with **chanfana** for OpenAPI-validated endpoints.

- Project type: Backend API service
- Runtime: Cloudflare Workers
- Language: TypeScript
- HTTP framework: Hono (entry app exports a native `fetch` handler — no Node.js HTTP shim)
- OpenAPI layer: chanfana + zod (schemas in `src/routes/*` are the single source of truth for request shapes and the generated docs)
- Production domain: `https://api.luna-stellaria.com`
- Deployment platform: Cloudflare Workers
- Package manager: Follow the lockfile present in the repository.

The application runs in Cloudflare's serverless edge environment rather than a traditional Node.js server. All code changes must account for Workers runtime constraints and compatibility requirements.

## Architecture: MVC (Model–View–Controller)

This project uses an MVC-inspired architecture with TypeScript, Hono, and chanfana, deployed on Cloudflare Workers.

The application separates data access, business logic, HTTP request handling, and response formatting to keep the code maintainable and testable.

### Request Flow

```text
Client
  |
  v
Cloudflare Workers (export default app — Hono fetch handler)
  |
  v
Hono application (src/app.ts)
  |
  v
Middleware (hono/logger, credentialed CORS)
  |
  v
Routes (chanfana OpenAPIRoute endpoint classes)
  |
  v
zod schema validation (chanfana: request bodies/params)
  |
  v
Services (Business Logic)
  |
  v
Models (D1 Data and Persistence)
  |
  v
Endpoint handler returns
  |
  v
JSON Response ({ success, data | error } envelope)
```

Validation failures (including malformed JSON) surface as chanfana `ApiException`s and are rendered by `app.onError` into the shared failure envelope.

### MVC Responsibilities

**Models**

Models represent application data and handle data persistence or database interactions.

- Define data structures and domain types.
- Encapsulate D1 queries; keep bindings (`env.lunadb`) out of services and endpoints.
- Avoid depending on Hono request/response objects.
- Keep database-specific implementation details out of services and endpoints.

**Views**

This is a REST API, so views primarily consist of JSON responses rather than server-rendered HTML templates.

- Return consistent JSON response structures (the `{ success, data | error }` envelope).
- Keep response formatting in the endpoints and `app.onError`, not in business logic.
- Do not introduce a template engine unless explicitly required.
- Avoid exposing internal model fields or sensitive information in API responses.

**Controllers**

Controllers are the chanfana `OpenAPIRoute` endpoint classes in `src/routes/`. They handle HTTP requests and coordinate application operations.

- Validate request bodies via the endpoint's zod schema (`this.getValidatedData()`), not by hand.
- Call services to execute business logic.
- Translate service results into HTTP responses with explicit status codes.
- Throw `HttpError` from the shared error module for expected client-facing failures; `app.onError` renders them.
- Avoid embedding database queries or complex business logic directly in endpoints.

### Services Layer

Although services are not one of the three MVC components, use a service layer to keep endpoints thin and business logic reusable.

- Implement application use cases and business rules.
- Coordinate operations involving multiple models or external services.
- Avoid coupling business logic directly to Hono request or response objects.
- Keep services independently testable.
- Return domain results or throw appropriately typed errors according to the project's established conventions.

### Routes

Routes define API endpoints and connect HTTP methods to validated endpoint classes.

- Endpoint classes live in the `src/routes/*.ts` files and are registered on the chanfana registry in `src/routes/index.ts` (`registerRoutes`). Registering an endpoint automatically adds it to `/openapi.json` and `/docs`.
- Apply authentication (`requireAuth`) and Turnstile verification where required. Auth is a helper returning the resolved user; Turnstile tokens are validated zod body fields verified inside the endpoint.
- Avoid placing business logic in route files.
- Keep the zod schemas accurate — they are both runtime validation and the published OpenAPI contract.

### Suggested Directory Structure

```text
src/
├── app.ts                  # Hono application factory (middleware, onError, notFound) + OpenAPI registry
├── index.ts                # Cloudflare Workers entry point (export default app)
├── env.d.ts                # Typed Worker secrets (JWT_SECRET, hf_endpoints, hf_endpoints_key, Turnstile_secret_key)
├── routes/                 # chanfana OpenAPIRoute endpoints + registry (health, auth, indobert)
│   ├── index.ts            # registerRoutes(app): fromHono registry + /openapi.json + /docs
│   └── auth.routes.ts      # endpoint classes with zod schema + handle()
├── services/               # Business logic (auth, indobert, turnstile, health)
├── models/                 # D1 data access (user)
├── middleware/             # CORS middleware, auth helper, HttpError + envelope renderers
├── utils/                  # Cookie helpers (session cookie)
└── types/                  # Shared API types (envelope, domain types, Hono AppEnv)
migrations/                 # D1 SQL migrations (numbered)
wrangler.jsonc              # Worker config (custom domain, D1 binding, previews)
```

### Dependency Direction

Maintain the following dependency direction:

```text
Routes (endpoint classes)
  |
  v
Services
  |
  v
Models / Data Access
```

Supporting modules such as middleware helpers, shared types, and utilities may be imported where needed.

- Models must not depend on services or endpoints.
- Services must not depend on Hono request or response objects.
- Endpoints must not contain direct database queries.
- Routes (endpoint classes) must not implement business logic beyond request handling.
- Avoid circular dependencies between layers.
- Keep Cloudflare-specific runtime integration at the application entry point or dedicated infrastructure boundary.

### Cloudflare Workers Compatibility

MVC components must remain compatible with the Cloudflare Workers runtime.

- The entry point exports the Hono app directly (`export default app` in `src/index.ts`); do not add `app.listen()`, a Node.js HTTP shim, or a standalone server.
- Access environment bindings and secrets via `import { env } from 'cloudflare:workers'`.
- Do not assume persistent in-memory state, unrestricted filesystem access, or unrestricted Node.js API support.
- Ensure models and services use bindings supported by the deployed runtime (D1 here).
- Schema validation is request-time, runtime validation — TypeScript types alone do not validate HTTP payloads. Extend the zod schemas, not ad-hoc checks.

### Hono Integration

Hono operates natively inside the Workers runtime.

- `createApp()` in `src/app.ts` builds the application; middleware order is `hono/logger` → credentialed CORS → routes → `app.onError` → `app.notFound`.
- The chanfana registry is created once via `fromHono(app, { docs_url: '/docs', openapi_url: '/openapi.json', ... })`; do not replace it with plain Hono routing or lose the docs endpoints.
- Expected errors flow through `HttpError` → `app.onError` → shared envelope; chanfana `ApiException`s (schema/parse failures) map to `400 VALIDATION_ERROR` with details.
- Keep `nodejs_compat` enabled; services use `argon2`/`jose`, which depend on it.
- After any framework or chanfana major upgrade, smoke-test the actual Workers environment (`wrangler dev`): `/health`, `/openapi.json`, `/docs`, register→login→me cookie flow, and one classify call.

Do not replace Hono or chanfana with another framework unless explicitly requested.

## Custom Domain

The production API is available at:

`https://api.luna-stellaria.com`

When modifying deployment configuration:

- Preserve the existing custom-domain and Worker routing configuration in `wrangler.jsonc` (including the preview-only wildcard entry). Do not create conflicting routes or duplicate custom-domain configuration.
- Do not assume that local development uses the production hostname — `wrangler dev` rewrites `Host` to the route's hostname even for `localhost`, so never branch request logic on `Host`.
- Keep development, preview, and production configuration separate where appropriate.
- Avoid hardcoding the production domain in application logic when relative URLs or environment-specific configuration are sufficient. Cookie scoping is decided by the request URL scheme (HTTPS or not), not the hostname.

Cloudflare DNS, domain ownership, SSL/TLS, and Worker deployment settings may require configuration outside the source repository. Do not claim that a domain or deployment is operational without verification.

## TypeScript Guidelines

Use TypeScript for application code and preserve the repository's existing compiler configuration.

- Prefer explicit types for public interfaces, service boundaries, and complex data structures.
- Avoid `any`; use `unknown` when the type is not known and narrow it before use.
- Use type inference for straightforward local variables.
- Keep shared types in appropriate modules rather than duplicating them.
- Validate untrusted request input at runtime via the zod endpoint schemas.
- Handle nullable values and potentially missing fields explicitly.
- Do not suppress type errors with `@ts-ignore` unless there is a documented and necessary reason.
- Prefer small, focused functions with clear responsibilities.
- Preserve existing naming conventions and module import patterns (`.ts` import extensions, `verbatimModuleSyntax`, `erasableSyntaxOnly` are on).

Do not change compiler settings merely to bypass errors.

## Hono + chanfana API Guidelines

- Endpoint classes stay focused on HTTP concerns; reusable business logic lives in services.
- Keep zod schemas as close as possible to the documented payloads (`README.md` documents them per endpoint).
- Return consistent response structures and HTTP status codes; use `HttpError` with a stable `code` for expected failures.
- Stable error codes in circulation: `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `NAME_TAKEN`, `UNAUTHORIZED`, `NOT_FOUND`, `TURNSTILE_FAILED`, `UPSTREAM_ERROR`, `INTERNAL_ERROR`. Do not invent new codes without updating the docs.
- Malformed JSON and schema violations both render as `400 VALIDATION_ERROR` with chanfana's error details under `error.details` (the old separate `INVALID_JSON` code no longer exists; split it again in `app.onError` if a consumer needs the distinction).
- Forward asynchronous errors through `app.onError` — never swallow them or return success after a failed operation.
- Avoid leaking stack traces, secrets, or internal error details in responses.
- Do not add global middleware that changes existing endpoint behavior without understanding its impact.
- Preserve backward compatibility for existing API consumers unless a breaking change is requested.

## Environment Variables, Secrets, and Bindings

Use Cloudflare Worker bindings and the existing configuration approach for runtime dependencies (D1 `lunadb`, secrets listed in `src/env.d.ts`).

Rules:

1. Never commit secrets, tokens, credentials, or private keys.
2. Never hardcode production secrets in source files.
3. Use Cloudflare's secret-management facilities (`.dev.vars` locally, `wrangler secret put` in production, Previews Base configuration for previews).
4. Document required variable names and their purposes without documenting their secret values.
5. Keep local development configuration separate from production configuration.
6. Access bindings via `import { env } from 'cloudflare:workers'` — do not assume `process.env` behaves as in a conventional Node.js deployment.
7. Do not expose secrets through API responses, logs, or client-side code.

Before adding a binding, inspect `wrangler.jsonc` and the runtime types (`npm run gen` regenerates `worker-configuration.d.ts` after config changes).

## Security

Treat every external request as untrusted input.

- Validate and sanitize input via the zod endpoint schemas: request bodies (including `turnstile_token`), email/name constraints, and lengths are enforced there.
- Use parameterized database queries through the D1 APIs.
- Enforce authentication (`requireAuth`) and Turnstile verification where required.
- Avoid logging access tokens, passwords, authorization headers, or sensitive personal information.
- Apply rate-limiting controls where the architecture supports them.
- Configure CORS deliberately; the credentialed allowlist in `src/middleware/cors.ts` (any HTTPS host in the `luna-stellaria.com` zone plus `localhost`/`127.0.0.1` for dev) is intentional — never use `*`.
- Do not treat CORS as a replacement for authentication or authorization.
- Keep dependencies updated through deliberate, compatible changes; `package.json` `overrides` currently pin `minimatch` and `katex` to patched versions while upstream packages await releases — remove them when unnecessary (verify with `npm audit` after removing).
- Use secure cookie settings in `src/utils/cookies.ts`: `httpOnly`, `sameSite: 'Lax'`, `secure` + `Domain=.luna-stellaria.com` only when the request is HTTPS; host-only and non-secure under plain-HTTP local development.
- Avoid returning internal exception details to clients.

Do not introduce authentication, authorization, or other security behavior that changes the API contract without reviewing existing requirements.

## Error Handling and Logging

Use centralized error handling via `app.onError` in `src/app.ts`.

- Distinguish expected client errors (`HttpError`) from unexpected server errors.
- Expected errors render the documented failure envelope with their own status code; chanfana validation failures render as `400 VALIDATION_ERROR` with details; anything else logs and returns a generic `500 INTERNAL_ERROR`.
- Return stable, documented error response formats.
- Log actionable diagnostic information without exposing sensitive values (`console.error` in `app.onError`; Workers observability ships logs to the platform log stream — do not rely on writing to the filesystem).
- Include request context (method + path) in error logs.
- Ensure errors are handled correctly within the Workers execution model.
- Avoid swallowing exceptions or returning success responses after failed operations.

## Testing and Validation

Before considering a change complete, run the applicable checks defined by the repository.

- `npm run typecheck` (`tsc --noEmit`)
- `npm run lint` (Prettier check + ESLint — run `npm run format` first when Prettier complains)
- `npm audit` for dependency changes
- Manual `wrangler dev` smoke test when endpoint or framework behavior changes: `/health`, `/openapi.json`, `/docs`, register→login→me cookie flow, one classify call.

No test framework is configured. Validation is typecheck, lint, audit, and manual `wrangler dev` checks. When changing API behavior, update both the zod schemas and the `README.md` payload docs.

## Dependencies

Before adding or upgrading a dependency:

1. Check whether the functionality already exists in the project (Hono, chanfana, or zod often cover it).
2. Confirm compatibility with Cloudflare Workers and the Hono + chanfana integration.
3. Consider package size, runtime support, security, and maintenance.
4. Prefer minimal dependency changes; `chanfana` 2→3 and `zod` 3→4 were deliberate major bumps — re-verify runtime behavior (OpenAPI generation, docs) after future majors.
5. Update the lockfile and run `npm run typecheck` and `npm run lint`.
6. Keep the `overrides` block only as long as needed for security pins (currently `minimatch`, `katex`); audit after removal.

Do not introduce dependencies that require unsupported native binaries, unrestricted filesystem access, or unavailable OS features without verifying compatibility.

## Development and Deployment Workflow

When starting work:

1. Inspect the repository structure and existing project documentation.
2. Read `package.json`, the TypeScript configuration, `wrangler.jsonc`, and the Worker entry point (`src/index.ts` → `src/app.ts`).
3. Identify the current route conventions (chanfana endpoint classes + `registerRoutes`).
4. Check the available development, testing, and deployment scripts.
5. Make the smallest change that correctly addresses the task.
6. Run relevant validation commands (`typecheck`, `lint`, `audit`, `wrangler dev` smoke).
7. Review the final diff for accidental changes, secrets, configuration regressions, and unrelated modifications.

For deployment:

- Use the project's existing deployment workflow (`npm run deploy`).
- Confirm the intended Cloudflare account, Worker name, environment, and domain configuration.
- Do not modify production bindings or secrets without explicit authorization.
- Do not execute a production deployment unless it is explicitly requested and authorized.
- Report which checks passed and which could not be completed.

## Instructions for AI Coding Agents

When modifying this repository:

- Treat existing source code and configuration as the primary source of truth.
- Follow established conventions rather than introducing a new architecture by default.
- Read relevant files before editing them.
- Avoid unrelated refactoring.
- Preserve public API contracts unless instructed otherwise.
- Do not invent database schemas, bindings, environment variables, endpoints, or package scripts.
- Do not assume integrations are configured merely because they are mentioned in documentation.
- Prefer explicit, minimal, maintainable changes.
- Update documentation when a change affects setup, configuration, deployment, or API behavior — including the zod schema ↔ docs pairing.
- Never report tests, builds, or deployments as successful unless they were actually executed and verified.
- If requirements are ambiguous and affect security, production infrastructure, or compatibility, inspect the repository first and ask for clarification when necessary.

## Project-Specific Notes

The following details must be verified against the actual repository rather than assumed:

- Worker entry-point file and Hono export shape.
- chanfana registry configuration (`docs_url`, `openapi_url`, OpenAPI `info`).
- Node.js compatibility settings and `nodejs_compat` flags.
- Package manager and available scripts.
- Route and endpoint directory structure.
- Database and external service integrations.
- Authentication and authorization mechanisms.
- Environment bindings and secret names.
- Testing workflow and deployment workflow.
- Cloudflare account, Worker name, and environment configuration.

Keep this document aligned with the actual implementation as the project evolves.

## This Repository At A Glance

Concrete values for this project (verify against the code when in doubt):

- **Entry point:** `src/index.ts` exports `default app` from `src/app.ts` (`createApp()` + `export default createApp()`). Hono provides the Workers `fetch` handler directly — there is no `cloudflare:node` shim and **no port routing** to keep in sync.
- **Compatibility:** `nodejs_compat` (see `wrangler.jsonc`). Import extensions are `.ts` (`verbatimModuleSyntax`, `erasableSyntaxOnly` are on).
- **Env access:** always `import { env } from 'cloudflare:workers'` inside handlers/services/models; the binding is `env.lunadb` (D1). Secrets are typed in `src/env.d.ts`.
- **Layering:** `routes/` (chanfana `OpenAPIRoute` endpoint classes with zod schemas) → `services/` → `models/`. Expected errors throw `HttpError` from `src/middleware/error-handler.ts`; `app.onError` renders them (plus chanfana `ApiException` validation failures) into the `{ success, data | error }` envelope.
- **Routes:** registered in `src/routes/index.ts` (`registerRoutes`) via chanfana's `fromHono(app, …)` registry. Middleware order is `hono/logger` → credentialed CORS → routes → `app.onError` → `app.notFound`.
- **Endpoints:** `/health`; `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/account/{name,email,password}`; `/ai/indobert/classify` (auth required for `me` and the account routes and classify; register/login/classify require a Cloudflare Turnstile token as the zod-validated `turnstile_token` body field, verified server-side against siteverify). `/openapi.json` serves the generated OpenAPI spec, `/docs` serves Swagger UI — both generated from the zod schemas by chanfana. See `README.md` for payloads and the response envelope.
- **Auth:** 7-day HS256 JWT (`jose`) in an httpOnly `jwt` cookie (`hono/cookie`), scoped to `Domain=.luna-stellaria.com` plus `Secure` whenever the request URL is HTTPS, and host-only + non-secure under plain HTTP (see `src/utils/cookies.ts`). Decide cookie scope by the URL scheme, **not** the host — `wrangler dev` rewrites `Host` to the custom-domain route even for `localhost`, so a host-based check would wrongly send a `.luna-stellaria.com` cookie that `localhost` browsers reject. Passwords use `argon2` (default hardness); legacy bcrypt hashes are transparently rehashed to argon2 on next successful authentication. `requireAuth` (`src/middleware/auth.ts`) resolves the cookie to an `AuthUser` or throws `401 UNAUTHORIZED`.
- **CORS:** credentialed allowlist in `src/middleware/cors.ts` (any HTTPS host in the `luna-stellaria.com` zone — production, `www`, and version previews like `<preview>.preview.luna-stellaria.com` — plus localhost/127.0.0.1 for dev). Never use `*`. `OPTIONS` preflights return `204`.
- **Secrets:** `JWT_SECRET`, `hf_endpoints`, `hf_endpoints_key`, `Turnstile_secret_key` — `.dev.vars` locally (gitignored, template in `.dev.vars.example`), `wrangler secret put` in production, `npx wrangler preview base-config secret put` for the Previews Base configuration (copied into each new preview).
- **Environments:** three tiers, all inside the `luna-stellaria.com` zone. Development = `wrangler dev` (`.dev.vars`, `ENVIRONMENT="development"`). Preview = `npx wrangler preview` (Wrangler 4.135+ Worker Previews): isolated copy per branch on the preview-only wildcard `*.preview-api.luna-stellaria.com` (route entry with `previews_enabled: true, enabled: false`), its own `lunadb` binding pointed at `lunadb-preview`, vars in the `previews` block (`ENVIRONMENT: "preview"`), secrets from the Base configuration. Production = `npm run deploy`: top-level `vars`, `lunadb`, `wrangler secret put`. `preview_urls: false` keeps previews off `workers.dev`.
- **Database:** D1 `lunadb` (binding `lunadb`), migrations in `migrations/` applied with `npx wrangler d1 migrations apply lunadb --local|--remote`. Never edit an applied migration; add a new numbered file. The `users` table is defined in `0001_create-auth.sql`.
- **Scripts:** `dev` (`wrangler dev`, port 8787), `typecheck` (`tsc --noEmit`), `build` (`gen` + `typecheck`), `lint` (`prettier --check . && eslint .`), `format`, `gen` (`wrangler types`), `deploy`. Run `npm run gen` after changing `wrangler.jsonc`.
- **Frontend:** this API serves the separate [`luna-stellaria`](../luna-stellaria) frontend, which calls it cross-origin with `credentials: 'include'`.
- **No test framework is configured** — validation is `typecheck`, `lint`, `npm audit`, and manual `wrangler dev` checks.
