import express from 'express';
import type { Express } from 'express';
import { cors } from './middleware/cors.ts';
import { errorHandler } from './middleware/error-handler.ts';
import { notFoundHandler } from './middleware/not-found.ts';
import { requestLogger } from './middleware/request-logger.ts';
import { registerRoutes } from './routes/index.ts';

/**
 * Builds the Express application.
 *
 * Kept separate from the Workers entry point so the app can be created and
 * exercised independently of the Cloudflare runtime binding.
 */
export function createApp(): Express {
	const app = express();

	app.disable('x-powered-by');
	app.use(requestLogger);
	app.use(cors);
	app.use(express.json({ limit: '1mb' }));

	registerRoutes(app);

	// Order matters: not-found runs after routes, the error handler last.
	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
}
