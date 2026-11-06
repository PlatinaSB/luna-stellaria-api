import type { Context } from 'hono';
import { HttpError } from './error-handler.ts';
import { verifySession } from '../services/auth.service.ts';
import { readSessionCookie } from '../utils/cookies.ts';
import type { AuthUser } from '../types/index.ts';

/**
 * Resolves the session cookie to an authenticated user, or rejects the
 * request. Handlers consume the return value directly.
 */
export async function requireAuth(c: Context): Promise<AuthUser> {
	const user = await verifySession(readSessionCookie(c));

	if (!user) {
		throw new HttpError('Authentication required.', { status: 401, code: 'UNAUTHORIZED' });
	}

	return user;
}
