import type { NextFunction, Request, Response } from 'express';
import type { ApiFailure } from '../types/index.ts';

export interface HttpErrorOptions {
	/** HTTP status code to return to the client. */
	status: number;
	/** Stable, machine-readable error code. */
	code: string;
	/** Optional structured context, such as validation failures. */
	details?: unknown;
}

/**
 * Error type used by services and controllers to signal an expected
 * client-facing failure with a specific status code.
 */
export class HttpError extends Error {
	readonly status: number;
	readonly code: string;
	readonly details?: unknown;

	constructor(message: string, options: HttpErrorOptions) {
		super(message);
		this.name = 'HttpError';
		this.status = options.status;
		this.code = options.code;
		this.details = options.details;
	}
}

/**
 * Centralized Express error handler.
 *
 * Known `HttpError`s are translated into the shared failure envelope. Anything
 * else is treated as an unexpected server error and its details are logged
 * rather than returned to the client.
 */
export function errorHandler(
	error: unknown,
	req: Request,
	res: Response,
	next: NextFunction
): void {
	// Delegate to the default handler once the response has started streaming.
	if (res.headersSent) {
		next(error);
		return;
	}

	if (error instanceof HttpError) {
		const body: ApiFailure = {
			success: false,
			error: {
				code: error.code,
				message: error.message,
				...(error.details === undefined ? {} : { details: error.details })
			}
		};

		res.status(error.status).json(body);
		return;
	}

	console.error(`[error] ${req.method} ${req.originalUrl}`, error);

	const body: ApiFailure = {
		success: false,
		error: {
			code: 'INTERNAL_ERROR',
			message: 'An unexpected error occurred.'
		}
	};

	res.status(500).json(body);
}
