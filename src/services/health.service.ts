import type { HealthStatus } from '../types/index.ts';

/**
 * Reports the current health of the service.
 *
 * Dependency checks (database, external services) belong here as they are
 * introduced.
 */
export function getHealthStatus(): HealthStatus {
	return {
		status: 'ok',
		timestamp: new Date().toISOString()
	};
}
