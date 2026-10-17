import type { Request, Response } from 'express';
import { getHealthStatus } from '../services/health.service.ts';
import type { ApiSuccess, HealthStatus } from '../types/index.ts';

/** `GET /health` */
export function getHealth(req: Request, res: Response): void {
	const body: ApiSuccess<HealthStatus> = {
		success: true,
		data: getHealthStatus()
	};

	res.status(200).json(body);
}
