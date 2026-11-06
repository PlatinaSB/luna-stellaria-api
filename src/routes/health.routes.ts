import { fromHono, OpenAPIRoute } from 'chanfana';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';

import { getHealthStatus } from '../services/health.service.ts';
import type { ApiSuccess, HealthStatus } from '../types/index.ts';

export const healthRouter = fromHono(new Hono());

/** `GET /health` */
class Health extends OpenAPIRoute {
	schema = {
		tags: ['Health'],
		summary: 'Get service health status',
		responses: {
			'200': {
				description: 'Service is healthy.',
				content: {
					'application/json': {
						schema: z.object({
							success: z.literal(true),
							data: z.object({
								status: z.literal('ok'),
								timestamp: z.string()
							})
						})
					}
				}
			}
		}
	};

	async handle(c: Context): Promise<Response> {
		const body: ApiSuccess<HealthStatus> = { success: true, data: getHealthStatus() };

		return c.json(body, 200);
	}
}

healthRouter.get('/health', Health);
