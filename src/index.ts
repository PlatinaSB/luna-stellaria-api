import app from './app.ts';

/**
 * Cloudflare Workers entry point.
 *
 * Hono is a Workers-native framework — the app itself is the fetch
 * handler. No Node.js HTTP shim or port routing is required.
 */
export default app;
