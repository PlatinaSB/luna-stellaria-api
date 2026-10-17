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

## Architecture: MVC (Model–View–Controller)

This project uses an MVC-inspired architecture with TypeScript and Express.js, deployed on Cloudflare Workers.

The application separates data access, business logic, HTTP request handling, and response formatting to keep the code maintainable and testable.

### Request Flow

```text
Client
  |
  v
Cloudflare Workers
  |
  v
Express.js
  |
  v
Routes
  |
  v
Middleware
  |
  v
Controllers
  |
  v
Services (Business Logic)
  |
  v
Models (Data and Persistence)
  |
  v
Controllers
  |
  v
JSON Response
```

### MVC Responsibilities

**Models**

Models represent application data and handle data persistence or database interactions.

- Define data structures and domain types.
- Encapsulate database queries and persistence operations.
- Handle data-related operations and domain constraints where appropriate.
- Avoid depending on Express request and response objects.
- Keep database-specific implementation details out of controllers.

**Views**

This is a REST API, so views primarily consist of JSON responses rather than server-rendered HTML templates.

- Return consistent JSON response structures.
- Keep response formatting separate from business logic where practical.
- Do not introduce a template engine unless explicitly required.
- Avoid exposing internal model fields or sensitive information in API responses.

**Controllers**

Controllers handle HTTP requests and coordinate application operations.

- Read and validate request parameters, query strings, headers, and request bodies.
- Call services to execute business logic.
- Translate service results into HTTP responses.
- Set appropriate HTTP status codes.
- Forward errors to centralized Express error-handling middleware.
- Avoid embedding database queries or complex business logic directly in controllers.

### Services Layer

Although services are not one of the three MVC components, use a service layer to keep controllers thin and business logic reusable.

- Implement application use cases and business rules.
- Coordinate operations involving multiple models or external services.
- Avoid coupling business logic directly to Express request and response objects.
- Keep services independently testable.
- Return domain results or throw appropriately typed errors according to the project's established conventions.

### Routes

Routes define API endpoints and connect HTTP methods and paths to middleware and controllers.

- Keep route definitions separate from controller implementations.
- Apply authentication, authorization, and validation middleware where required.
- Use the existing route registration conventions.
- Avoid placing business logic directly in route files.

### Suggested Directory Structure

Follow the existing repository structure when one is already established. Otherwise, use the following structure as a reference:

```text
src/
├── app.ts                  # Express application configuration
├── index.ts                # Cloudflare Workers entry point
├── routes/
│   ├── index.ts             # Route registration
│   └── user.routes.ts
├── controllers/
│   └── user.controller.ts
├── services/
│   └── user.service.ts
├── models/
│   └── user.model.ts
├── middleware/
│   ├── error-handler.ts
│   └── not-found.ts
├── validators/
│   └── user.validator.ts
├── types/
│   └── index.ts
├── config/
│   └── index.ts
└── utils/
    └── index.ts
```

These filenames are illustrative. Adapt them to the actual application and database technology. Do not create empty directories or placeholder files without a concrete need.

### Dependency Direction

Maintain the following dependency direction:

```text
Routes
  |
  v
Controllers
  |
  v
Services
  |
  v
Models / Data Access
```

Supporting modules such as validators, configuration, shared types, and utilities may be imported where needed.

- Models must not depend on controllers.
- Services must not depend on Express request or response objects.
- Controllers must not contain direct database queries when a model or data-access abstraction is available.
- Routes must not implement business logic.
- Avoid circular dependencies between layers.
- Keep Cloudflare-specific runtime integration at the application entry point or dedicated infrastructure boundary.

### Cloudflare Workers Compatibility

MVC components must remain compatible with the Cloudflare Workers runtime.

- Do not start a conventional HTTP server with `app.listen()` unless required by the existing Workers adapter.
- Preserve the current Express-to-Workers integration.
- Access environment bindings and secrets through the established runtime integration.
- Do not assume persistent process state, unrestricted filesystem access, or unrestricted Node.js API support.
- Ensure models and services use database drivers and external clients supported by the deployed runtime.

### Testing Strategy

Test each layer independently where practical.

- **Models:** Test data access, queries, and persistence behavior.
- **Services:** Test business rules and interactions with mocked dependencies.
- **Controllers:** Test HTTP status codes, response bodies, and error forwarding.
- **Routes:** Test endpoint registration, middleware, authentication, and request validation.
- **Integration:** Test the complete request flow using the project's Workers-compatible test environment.

### Rules for AI Coding Agents

When implementing a feature:

1. Define or update the model and data-access operations when persistence is involved.
2. Implement business rules in the service layer.
3. Add or update the controller to coordinate the use case and construct the HTTP response.
4. Register the endpoint in the appropriate route file.
5. Add validation and security middleware as needed.
6. Add tests for the affected layers.
7. Update API documentation when endpoint behavior changes.

Do not introduce additional architectural layers unless they solve a concrete problem. Keep the MVC separation clear without adding unnecessary abstractions.

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
