import type { Request, Response } from 'express';
import type { ApiFailure } from '../types/index.ts';

/**
 * Terminal middleware for unmatched routes. Registered after all routes so it
 * only runs when nothing else handled the request.
 */
export function notFoundHandler(req: Request, res: Response): void {
	const body: ApiFailure = {
		success: false,
		error: {
			code: 'NOT_FOUND',
			message: `Cannot ${req.method} ${req.originalUrl}.`
		}
	};

	res.status(404).json(body);
}
