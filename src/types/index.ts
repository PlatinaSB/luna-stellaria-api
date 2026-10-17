/**
 * Shared, cross-cutting types for the HTTP API.
 *
 * These describe the stable JSON response envelope returned by every endpoint
 * plus the domain types shared between models, services, and controllers.
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

/** Authenticated user exposed to clients. Never includes credential material. */
export interface AuthUser {
	id: number;
	email: string;
	/** Public account name; changes are optional and unique across accounts. */
	display_name: string;
}

/** Persisted user row, including the password hash used only server-side. */
export interface UserRecord extends AuthUser {
	password_hash: string;
}

/** Result of a successful register or login. */
export interface AuthResult {
	user: AuthUser;
	token: string;
}

/** A single label/score pair returned by text classification. */
export interface Prediction {
	score: number;
	label: string;
}
