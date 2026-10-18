import type { NextFunction, Request, Response } from 'express';

/**
 * Origins allowed to call the API with credentials.
 *
 * Every deployed frontend sits inside the `luna-stellaria.com` zone — the
 * canonical site, plus version previews on subdomains like
 * `<branch>.preview.luna-stellaria.com`. Local development runs on
 * `localhost`/`127.0.0.1` on any port. Credentialed CORS must echo a specific
 * origin, so `*` is never used.
 */
const PRODUCTION_ORIGINS = new Set([
	'https://luna-stellaria.com',
	'https://www.luna-stellaria.com'
]);

/** Suffix shared by every deployable frontend host, including previews. */
const SITE_SUFFIX = 'luna-stellaria.com';

function isAllowedOrigin(origin: string): boolean {
	if (PRODUCTION_ORIGINS.has(origin)) {
		return true;
	}

	try {
		const { protocol, hostname } = new URL(origin);

		// Any deployed frontend host inside the zone (site, www, previews…).
		if (
			protocol === 'https:' &&
			(hostname === SITE_SUFFIX || hostname.endsWith(`.${SITE_SUFFIX}`))
		) {
			return true;
		}

		// Local development: plain-HTTP localhost on any port.
		return protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1');
	} catch {
		return false;
	}
}

/** Credentialed CORS handling, including preflight requests. */
export function cors(req: Request, res: Response, next: NextFunction): void {
	const origin = req.headers.origin;

	if (origin && isAllowedOrigin(origin)) {
		res.setHeader('Access-Control-Allow-Origin', origin);
		res.setHeader('Access-Control-Allow-Credentials', 'true');
		res.setHeader('Vary', 'Origin');
	}

	if (req.method === 'OPTIONS') {
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		res.setHeader('Access-Control-Max-Age', '86400');
		res.status(204).end();
		return;
	}

	next();
}
