import type { NextFunction, Request, Response } from 'express';
import { verifyTurnstileToken } from '../services/turnstile.service.ts';

/**
 * Rejects requests without a valid Cloudflare Turnstile token.
 *
 * The frontend sends the solved token as `turnstile_token`; verification
 * happens server-side against siteverify, so the secret never leaves the
 * Worker. Apply this only to routes that accept unauthenticated traffic.
 */
export async function requireTurnstile(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	try {
		const token = typeof req.body?.turnstile_token === 'string' ? req.body.turnstile_token : '';

		// Cloudflare injects the connecting IP; siteverify uses it for context.
		const header = req.headers['cf-connecting-ip'];
		const remoteIp = Array.isArray(header) ? header[0] : header;

		await verifyTurnstileToken(token, remoteIp);
		next();
	} catch (error) {
		next(error);
	}
}
