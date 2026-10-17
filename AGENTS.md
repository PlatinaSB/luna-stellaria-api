# AGENTS.md

## Project Overview

This project is a TypeScript-based HTTP API hosted on **Cloudflare Workers**, using **Express.js** as its web framework.

- **Project type:** Backend API service
- **Runtime:** Cloudflare Workers
- **Language:** TypeScript
- **HTTP framework:** Express.js
- **Production domain:** `https://api.luna-stellaria.com`
- **Deployment platform:** Cloudflare Workers
- **Package manager:** Follow the lockfile present in the repository.

The application runs in Cloudflare's serverless edge environment rather than a traditional Node.js server. All code changes must account for Workers runtime constraints and compatibility requirements.

## Architecture

The expected request flow is:

```text
Client
  |
  v
https://api.luna-stellaria.com
  |
  v
Cloudflare Network
  |
  v
Cloudflare Worker
  |
  v
Express.js Application
  |
  v
Middleware and Route Handlers
  |
  v
Services / Data Access
  |
  v
API Response
```

Keep responsibilities separated wherever practical:

- **Worker entry point:** Integrates the Cloudflare Workers runtime with the application.
- **Express application:** Configures middleware, routes, and error handling.
- **Routes:** Define HTTP endpoints and map requests to handlers.
- **Controllers:** Handle HTTP request and response concerns.
- **Services:** Contain business logic.
- **Data access:** Encapsulates database and external service interactions.
- **Types:** Define shared request, response, and domain types.
- **Configuration:** Centralizes environment-specific settings and runtime bindings.

Follow the existing repository structure if it differs from this suggested architecture. Do not introduce unnecessary layers or reorganize the project without a clear reason.

## Runtime and Cloudflare Workers

Cloudflare Workers is not a conventional Node.js server.

1. Do not assume unrestricted access to Node.js APIs, the filesystem, child processes, or operating-system functionality.
2. Check Cloudflare Workers compatibility requirements before introducing Node.js-dependent packages.
3. Preserve the existing `wrangler` configuration and compatibility settings.
4. Use Cloudflare Worker environment bindings for secrets, environment variables, databases, and other supported resources.
5. Do not start a conventional Express listener using `app.listen()` unless the project's established Cloudflare integration explicitly requires it.
6. Do not introduce a standalone HTTP server or a long-running process.
7. Ensure the Worker entry point exports the handler format expected by the configured runtime and Express integration.
8. Avoid assumptions about persistent in-memory state. A Worker instance may be reused, replaced, or scaled independently.
9. Use the platform's supported execution and resource lifecycle mechanisms for background work and external connections.

### Express.js Integration

Express.js must operate through a Cloudflare-compatible integration.

- Inspect the existing entry point and dependencies before modifying the integration.
- Preserve the current request adapter or runtime integration if one exists.
- Verify that the configured Node.js compatibility mode supports the APIs required by Express and its dependencies.
- Keep middleware compatible with the Workers request lifecycle.
- Avoid relying on unsupported Node.js server behavior.
- Test routing, middleware, error handling, and response generation in the actual Workers-compatible development environment.

Do not replace Express with another framework unless explicitly requested.

## Custom Domain

The production API is available at:

`https://api.luna-stellaria.com`

When modifying deployment configuration:

- Preserve the existing custom-domain and Worker routing configuration.
- Check `wrangler.toml`, `wrangler.json`, or `wrangler.jsonc`, depending on which file the repository uses.
- Verify that the deployed Worker is associated with `api.luna-stellaria.com`.
- Do not create conflicting routes or duplicate custom-domain configuration.
- Do not assume that local development uses the production hostname.
- Keep development, preview, and production configuration separate where appropriate.
- Avoid hardcoding the production domain in application logic when relative URLs or environment-specific configuration are sufficient.

Cloudflare DNS, domain ownership, SSL/TLS, and Worker deployment settings may require configuration outside the source repository. Do not claim that a domain or deployment is operational without verification.

## TypeScript Guidelines

Use TypeScript for application code and preserve the repository's existing compiler configuration.

- Prefer explicit types for public interfaces, service boundaries, and complex data structures.
- Avoid `any`; use `unknown` when the type is not known and narrow it before use.
- Use type inference for straightforward local variables.
- Keep shared types in appropriate modules rather than duplicating them.
- Validate untrusted request input at runtime. TypeScript types alone do not validate HTTP payloads.
- Handle nullable values and potentially missing fields explicitly.
- Do not suppress type errors with `@ts-ignore` unless there is a documented and necessary reason.
- Prefer small, focused functions with clear responsibilities.
- Preserve existing naming conventions and module import patterns.

Do not change compiler settings merely to bypass errors.

## Express API Guidelines

- Use the existing routing and middleware conventions.
- Keep route handlers focused on HTTP concerns.
- Put reusable business logic in services.
- Validate path parameters, query parameters, headers, and request bodies as appropriate.
- Return consistent response structures and HTTP status codes.
- Use the correct status code for validation failures, authentication failures, authorization failures, missing resources, and unexpected server errors.
- Forward asynchronous errors through the project's established error-handling mechanism.
- Register not-found handling and error-handling middleware in the appropriate order.
- Avoid leaking stack traces, secrets, internal errors, or sensitive data in production responses.
- Do not add global middleware that changes existing endpoint behavior without understanding its impact.
- Preserve backward compatibility for existing API consumers unless a breaking change is requested.

## Environment Variables, Secrets, and Bindings

Use Cloudflare Worker bindings and the existing configuration approach for runtime dependencies.

Examples of possible configuration include:

- Database connections or database bindings.
- API keys and third-party credentials.
- Authentication secrets.
- Public application configuration.
- Environment-specific feature flags.

Rules:

1. Never commit secrets, tokens, credentials, or private keys.
2. Never hardcode production secrets in source files.
3. Use Cloudflare's secret-management facilities for sensitive values.
4. Document required variable names and their purposes without documenting their secret values.
5. Keep local development configuration separate from production configuration.
6. Follow the project's existing pattern for accessing Worker environment bindings.
7. Do not assume `process.env` behaves exactly as it does in a conventional Node.js deployment.
8. Do not expose secrets through API responses, logs, or client-side code.

Before adding a binding, inspect the current Wrangler configuration and the project's runtime types.

## Security

Treat every external request as untrusted input.

- Validate and sanitize input where appropriate.
- Use parameterized database queries or the database driver's safe query APIs.
- Enforce authentication and authorization where required.
- Avoid logging access tokens, passwords, authorization headers, or sensitive personal information.
- Apply appropriate request-size limits and rate-limiting controls where the architecture supports them.
- Configure CORS deliberately; do not use permissive origins by default when credentials are involved.
- Do not treat CORS as a replacement for authentication or authorization.
- Keep dependencies updated through deliberate, compatible changes.
- Use secure cookie settings when cookies are part of the authentication design.
- Avoid returning internal exception details to clients.

Do not introduce authentication, authorization, or other security behavior that changes the API contract without reviewing existing requirements.

## Error Handling and Logging

Use centralized error handling wherever the existing application architecture permits.

- Distinguish expected client errors from unexpected server errors.
- Return stable, documented error response formats.
- Log actionable diagnostic information without exposing sensitive values.
- Include request context or correlation identifiers when supported by the existing logging strategy.
- Do not rely on writing logs to the local filesystem.
- Ensure errors are handled correctly within the Workers execution model.
- Avoid swallowing exceptions or returning success responses after failed operations.

## Testing and Validation

Before considering a change complete, run the applicable checks defined by the repository.

Typical checks may include:

- TypeScript type checking.
- Linting and formatting.
- Unit tests.
- API integration tests.
- Cloudflare Workers local development tests.
- Build or deployment dry-run checks.

Inspect `package.json` and the package manager's lockfile before selecting commands. Use existing scripts whenever possible rather than inventing new ones.

When changing API behavior, add or update tests for relevant success cases, validation failures, error cases, and authorization requirements.

Do not deploy to production merely to validate a routine code change.

## Dependencies

Before adding or upgrading a dependency:

1. Check whether the functionality already exists in the project.
2. Confirm compatibility with Cloudflare Workers and the current Express integration.
3. Consider package size, runtime support, security, and maintenance.
4. Prefer minimal dependency changes.
5. Update the appropriate lockfile.
6. Run relevant type checks and tests.

Do not introduce dependencies that require unsupported native binaries, unrestricted filesystem access, or unavailable operating-system features without verifying compatibility.

## Development and Deployment Workflow

When starting work:

1. Inspect the repository structure and existing project documentation.
2. Read `package.json`, the TypeScript configuration, the Wrangler configuration, and the Worker entry point.
3. Identify the actual Express integration and current route conventions.
4. Check the available development, testing, and deployment scripts.
5. Make the smallest change that correctly addresses the task.
6. Run relevant validation commands.
7. Review the final diff for accidental changes, secrets, configuration regressions, and unrelated modifications.

For deployment:

- Use the project's existing deployment workflow.
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
- Update documentation when a change affects setup, configuration, deployment, or API behavior.
- Never report tests, builds, or deployments as successful unless they were actually executed and verified.
- If requirements are ambiguous and affect security, production infrastructure, or compatibility, inspect the repository first and ask for clarification when necessary.

## Project-Specific Notes

The following details must be verified against the actual repository rather than assumed:

- Worker entry-point file.
- Express-to-Workers adapter or integration.
- Node.js compatibility settings.
- Package manager and available scripts.
- Route and controller directory structure.
- Database and external service integrations.
- Authentication and authorization mechanisms.
- Environment bindings and secret names.
- Testing framework and deployment workflow.
- Cloudflare account, Worker name, and environment configuration.

Keep this document aligned with the actual implementation as the project evolves.
