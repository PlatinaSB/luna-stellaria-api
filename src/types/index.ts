/**
 * Shared, cross-cutting types for the HTTP API.
 *
 * These describe the stable JSON response envelope returned by every endpoint.
 */

export interface ApiErrorBody {
	/** Stable, machine-readable error code. */
	code: string;
	/** Human-readable message safe to expose to API consumers. */
	message: string;
	/** Optional structured context, such as validation failures. */
	details?: unknown;
}

export interface ApiSuccess<TData> {
	success: true;
	data: TData;
}

export interface ApiFailure {
	success: false;
	error: ApiErrorBody;
}

/** Consistent response envelope used by all endpoints. */
export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

/** Payload returned by the health endpoint. */
export interface HealthStatus {
	status: 'ok';
	timestamp: string;
}
