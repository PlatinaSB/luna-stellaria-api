import { contentJson, fromHono, OpenAPIRoute } from 'chanfana';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.ts';
import { apiErrorResponse } from '../middleware/error-handler.ts';
import { classifyText } from '../services/indobert.service.ts';
import { verifyTurnstileToken } from '../services/turnstile.service.ts';
import type { ApiSuccess, Prediction } from '../types/index.ts';

export const indobertRouter = fromHono(new Hono());

const classifyBody = z.object({
	text: z.string().min(1),
	turnstile_token: z.string()
});

/** `POST /ai/indobert/classify` */
class Classify extends OpenAPIRoute {
	schema = {
		tags: ['AI'],
		summary: 'Classify Indonesian text with IndoBERT',
		request: { body: contentJson(classifyBody) },
		responses: {
			'200': {
				description: 'Classification predictions.',
				content: {
					'application/json': {
						schema: z.object({
							success: z.literal(true),
							data: z.object({
								predictions: z.array(z.object({ score: z.number(), label: z.string() }))
							})
						})
					}
				}
			},
			'400': apiErrorResponse('Validation failure or Turnstile verification failed.'),
			'401': apiErrorResponse('No valid session.'),
			'502': apiErrorResponse('IndoBERT service failure.')
		}
	};

	async handle(c: Context): Promise<Response> {
		await requireAuth(c);

		const { body } = await this.getValidatedData<typeof this.schema>();

		await verifyTurnstileToken(body.turnstile_token, c.req.header('cf-connecting-ip'));

		const predictions = await classifyText(body.text.trim());

		const response: ApiSuccess<{ predictions: Prediction[] }> = {
			success: true,
			data: { predictions }
		};
		return c.json(response, 200);
	}
}

indobertRouter.post('/ai/indobert/classify', Classify);
