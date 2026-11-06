import { z } from 'zod';
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
 * Error type used by services and endpoints to signal an expected
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

/** Renders an expected failure into the shared failure envelope. */
export function toApiFailure(error: HttpError): ApiFailure {
	return {
		success: false,
		error: {
			code: error.code,
			message: error.message,
			...(error.details === undefined ? {} : { details: error.details })
		}
	};
}

/** OpenAPI schema shared by every documented error response. */
export const apiFailureSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.unknown().optional()
	})
});

/** Builds an OpenAPI response entry for a documented failure. */
export function apiErrorResponse(description: string) {
	return {
		description,
		content: { 'application/json': { schema: apiFailureSchema } }
	};
}
