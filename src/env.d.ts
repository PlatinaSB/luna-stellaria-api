/**
 * Worker secrets consumed by the API.
 *
 * Bindings declared in `wrangler.jsonc` (for example the `lunadb` D1 database)
 * are typed by the generated `worker-configuration.d.ts`. Secrets are not part
 * of the Wrangler config, so they are declared here to keep `env.*` typed even
 * when a local `.dev.vars` file is absent. Values are provided at runtime via
 * `wrangler secret put` (production) or `.dev.vars` (local development).
 */
declare namespace Cloudflare {
	interface Env {
		JWT_SECRET: string;
		hf_endpoints: string;
		hf_endpoints_key: string;
		Turnstile_secret_key: string;
	}
}
