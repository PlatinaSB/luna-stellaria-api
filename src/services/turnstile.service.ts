import { env } from 'cloudflare:workers';
import { HttpError } from '../middleware/error-handler.ts';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Reads the Worker secret; missing configuration is a server fault, not a client error. */
function getTurnstileSecret(): string {
	const secret = env.Turnstile_secret_key;

	if (!secret) {
		throw new Error('Turnstile_secret_key is not configured.');
	}

	return secret;
}

/**
 * Verifies a Cloudflare Turnstile challenge token with the siteverify API.
 *
 * The widget token is untrusted client input, so the check must run
 * server-side — the secret is never exposed to the browser. Throws
 * `TURNSTILE_FAILED` when the token is missing or rejected and
 * `UPSTREAM_ERROR` when Cloudflare cannot be reached.
 */
export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<void> {
	const secret = getTurnstileSecret();

	if (!token) {
		throw new HttpError('Please complete the human verification challenge.', {
			status: 400,
			code: 'TURNSTILE_FAILED'
		});
	}

	let response: Response;

	try {
		response = await fetch(SITEVERIFY_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				secret,
				response: token,
				...(remoteIp ? { remoteip: remoteIp } : {})
			})
		});
	} catch {
		throw new HttpError('Unable to reach the Turnstile verification service.', {
			status: 502,
			code: 'UPSTREAM_ERROR'
		});
	}

	const result = (await response.json().catch(() => null)) as { success?: unknown } | null;

	if (!response.ok || !result?.success) {
		throw new HttpError('Human verification failed. Please try again.', {
			status: 400,
			code: 'TURNSTILE_FAILED'
		});
	}
}
