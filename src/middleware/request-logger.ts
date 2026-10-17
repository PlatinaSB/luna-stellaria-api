import type { NextFunction, Request, Response } from 'express';

/**
 * Logs one line per completed request. Kept intentionally lightweight because
 * Workers logs are written to the platform's log stream, not the filesystem.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
	const startedAt = Date.now();

	res.on('finish', () => {
		const durationMs = Date.now() - startedAt;
		console.log(`[request] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
	});

	next();
}
