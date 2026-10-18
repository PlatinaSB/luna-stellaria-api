import type { CookieOptions, Request, Response } from 'express';

export const SESSION_COOKIE_NAME = 'jwt';

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const PRODUCTION_COOKIE_DOMAIN = '.luna-stellaria.com';

/**
 * The session cookie is shared with the apex domain so the frontend (and any
 * deployed preview of it, e.g. `<branch>.preview.luna-stellaria.com`) can
 * present server-rendered auth state. All deployed hosts sit inside the
 * `luna-stellaria.com` zone, so domain scoping is safe whenever the request is
 * HTTPS, and everything stays same-site (`sameSite: 'lax'`).
 *
 * Detection is based on the request being HTTPS rather than the hostname:
 * `wrangler dev` rewrites `Host`/`req.hostname` to the custom-domain route
 * (`api.luna-stellaria.com`) even for `localhost`, so the host is useless as a
 * dev signal. Cloudflare terminates TLS in production, so `req.secure` is true
 * there and false under plain-HTTP local development, where a host-only cookie
 * is required (a `.luna-stellaria.com` cookie is rejected by a `localhost`
 * browser).
 */
function baseCookieOptions(req: Request): CookieOptions {
	const options: CookieOptions = {
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secure: req.secure
	};

	if (req.secure) {
		options.domain = PRODUCTION_COOKIE_DOMAIN;
	}

	return options;
}

/** Reads a single cookie value from the request `Cookie` header. */
export function readCookie(req: Request, name: string): string | undefined {
	const header = req.headers.cookie;

	if (!header) {
		return undefined;
	}

	for (const part of header.split(';')) {
		const separator = part.indexOf('=');

		if (separator === -1) {
			continue;
		}

		if (part.slice(0, separator).trim() === name) {
			return decodeURIComponent(part.slice(separator + 1).trim());
		}
	}

	return undefined;
}

/** Sets the session cookie holding the signed JWT. */
export function setSessionCookie(req: Request, res: Response, token: string): void {
	res.cookie(SESSION_COOKIE_NAME, token, { ...baseCookieOptions(req), maxAge: SESSION_MAX_AGE_MS });
}

/** Clears the session cookie. */
export function clearSessionCookie(req: Request, res: Response): void {
	res.clearCookie(SESSION_COOKIE_NAME, baseCookieOptions(req));
}
