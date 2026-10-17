import type { Request, Response } from 'express';
import { HttpError } from '../middleware/error-handler.ts';
import { classifyText } from '../services/indobert.service.ts';
import type { ApiSuccess, Prediction } from '../types/index.ts';

/** `POST /ai/indobert/classify` */
export async function classifyIndobert(req: Request, res: Response): Promise<void> {
	const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';

	if (!text) {
		throw new HttpError('Text cannot be empty.', { status: 400, code: 'VALIDATION_ERROR' });
	}

	const predictions = await classifyText(text);

	const body: ApiSuccess<{ predictions: Prediction[] }> = {
		success: true,
		data: { predictions }
	};
	res.status(200).json(body);
}
