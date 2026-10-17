import type { Express } from 'express';
import { authRouter } from './auth.routes.ts';
import { healthRouter } from './health.routes.ts';
import { indobertRouter } from './indobert.routes.ts';

/** Mounts every router onto the Express application. */
export function registerRoutes(app: Express): void {
	app.use(healthRouter);
	app.use(authRouter);
	app.use(indobertRouter);
}
