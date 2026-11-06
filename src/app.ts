import { ApiException } from 'chanfana';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { logger } from 'hono/logger';

import { cors } from './middleware/cors.ts';
import { HttpError, toApiFailure } from './middleware/error-handler.ts';
import { registerRoutes } from './routes/index.ts';
import type { ApiFailure, AppEnv } from './types/index.ts';

/**
 * Builds the Hono application.
 *
 * Kept separate from the Workers entry point so the app can be created and
 * exercised independently of the Cloudflare runtime binding.
 */
export function createApp(): Hono<AppEnv> {
	const app = new Hono<AppEnv>();

	app.use('*', logger());

	app.use('*', cors);

	registerRoutes(app);

	app.notFound((c) =>
		c.json(
			{
				success: false,
				error: { code: 'NOT_FOUND', message: `Cannot ${c.req.method} ${c.req.path}.` }
			} satisfies ApiFailure,
			404
		)
	);

	app.onError((error, c) => {
		// Expected, client-facing failures render into the shared envelope.
		if (error instanceof HttpError) {
			return c.json(toApiFailure(error), error.status as ContentfulStatusCode);
		}

		// chanfana turns schema validation failures (including malformed JSON
		// bodies) into `ApiException`s.
		// ponytail: VALIDATION_ERROR / INVALID_JSON collapse into one code;
		// split them when the frontend needs to tell the two apart.
		if (error instanceof ApiException) {
			return c.json(
				{
					success: false,
					error: {
						code: 'VALIDATION_ERROR',
						message: 'Request validation failed.',
						details: error.buildResponse()
					}
				} satisfies ApiFailure,
				error.status as ContentfulStatusCode
			);
		}

		console.error(`[error] ${c.req.method} ${c.req.path}`, error);

		return c.json(
			{
				success: false,
				error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' }
			} satisfies ApiFailure,
			500
		);
	});

	return app;
}

export default createApp();
