import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './error-handler.ts';
import { verifySession } from '../services/auth.service.ts';
import { readCookie, SESSION_COOKIE_NAME } from '../utils/cookies.ts';
import type { AuthUser } from '../types/index.ts';

/**
 * Rejects unauthenticated requests and attaches the resolved user to
 * `res.locals.user` for downstream handlers.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
	try {
		const user = await verifySession(readCookie(req, SESSION_COOKIE_NAME));

		if (!user) {
			throw new HttpError('Authentication required.', { status: 401, code: 'UNAUTHORIZED' });
		}

		res.locals.user = user;
		next();
	} catch (error) {
		next(error);
	}
}

/** Reads the user attached by `requireAuth`. */
export function getAuthUser(res: Response): AuthUser {
	return res.locals.user as AuthUser;
}
