import { fromHono } from 'chanfana';
import type { Hono } from 'hono';

import { authRouter } from './auth.routes.ts';
import { healthRouter } from './health.routes.ts';
import { indobertRouter } from './indobert.routes.ts';
import type { AppEnv } from '../types/index.ts';

/**
 * Builds the OpenAPI registry on top of the application and mounts every
 * endpoint onto it. New endpoint classes register with one of the three
 * routers and automatically join `/openapi.json` and `/docs`.
 */
export function registerRoutes(app: Hono<AppEnv>): void {
	const openapi = fromHono(app, {
		docs_url: '/docs',
		openapi_url: '/openapi.json',
		schema: {
			info: {
				title: 'luna-stellaria API',
				version: '0.0.1',
				description: 'Backend API layer for luna-stellaria.'
			}
		}
	});

	openapi.route('/', healthRouter);
	openapi.route('/', authRouter);
	openapi.route('/', indobertRouter);
}
