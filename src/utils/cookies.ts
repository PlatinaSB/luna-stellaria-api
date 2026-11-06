import { getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';

export const SESSION_COOKIE_NAME = 'jwt';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const PRODUCTION_COOKIE_DOMAIN = '.luna-stellaria.com';

/**
 * The session cookie is shared with the apex domain so the frontend (and any
 * deployed preview of it, e.g. `<branch>.preview.luna-stellaria.com`) can
 * present server-rendered auth state. All deployed hosts sit inside the
 * `luna-stellaria.com` zone, so domain scoping is safe whenever the request is
 * HTTPS, and everything stays same-site (`sameSite: 'Lax'`).
 *
 * Detection is based on the request being HTTPS rather than the hostname:
 * `wrangler dev` rewrites `Host` to the custom-domain route
 * (`api.luna-stellaria.com`) even for `localhost`, so the host is useless as a
 * dev signal. Cloudflare terminates TLS in production, so the URL scheme is
 * `https:` there and `http:` under plain-HTTP local development, where a
 * host-only cookie is required (a `.luna-stellaria.com` cookie is rejected by
 * a `localhost` browser).
 */
interface SessionCookieOptions {
	httpOnly: true;
	path: '/';
	sameSite: 'Lax';
	secure: boolean;
	domain?: string;
}

function baseCookieOptions(c: Context): SessionCookieOptions {
	const secure = new URL(c.req.url).protocol === 'https:';

	return {
		httpOnly: true,
		path: '/',
		sameSite: 'Lax',
		secure,
		...(secure ? { domain: PRODUCTION_COOKIE_DOMAIN } : {})
	};
}

/** Reads the session cookie holding the signed JWT. */
export function readSessionCookie(c: Context): string | undefined {
	return getCookie(c, SESSION_COOKIE_NAME);
}

/** Sets the session cookie holding the signed JWT. */
export function setSessionCookie(c: Context, token: string): void {
	setCookie(c, SESSION_COOKIE_NAME, token, {
		...baseCookieOptions(c),
		maxAge: SESSION_MAX_AGE_SECONDS
	});
}

/** Clears the session cookie. */
export function clearSessionCookie(c: Context): void {
	setCookie(c, SESSION_COOKIE_NAME, '', { ...baseCookieOptions(c), maxAge: 0 });
}
