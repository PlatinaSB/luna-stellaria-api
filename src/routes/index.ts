import type { Express } from 'express';
import { healthRouter } from './health.routes.ts';

/** Mounts every router onto the Express application. */
export function registerRoutes(app: Express): void {
	app.use(healthRouter);
}
