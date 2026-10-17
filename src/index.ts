import { httpServerHandler } from 'cloudflare:node';
import { createApp } from './app.ts';

const port = 3000;

const app = createApp();
app.listen(port);

/**
 * Cloudflare Workers entry point.
 *
 * Express runs on top of the Workers implementation of `node:http`; the port
 * acts as a routing key between the Node.js server and this handler.
 */
export default httpServerHandler({ port });
