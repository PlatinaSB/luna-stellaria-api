import type { Request, Response } from 'express';
import { HttpError } from '../middleware/error-handler.ts';
import { loginUser, registerUser, verifySession } from '../services/auth.service.ts';
import {
	clearSessionCookie,
	readCookie,
	SESSION_COOKIE_NAME,
	setSessionCookie
} from '../utils/cookies.ts';
import type { ApiSuccess, AuthUser } from '../types/index.ts';

function readBodyString(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

/** `POST /auth/register` */
export async function register(req: Request, res: Response): Promise<void> {
	const email = readBodyString(req.body?.email).trim().toLowerCase();
	const password = readBodyString(req.body?.password);
	const confirmPassword = readBodyString(req.body?.confirm_password);

	if (!email || !password || !confirmPassword) {
		throw new HttpError('All fields are required.', { status: 400, code: 'VALIDATION_ERROR' });
	}

	const { user, token } = await registerUser({ email, password, confirmPassword });

	setSessionCookie(req, res, token);

	const body: ApiSuccess<{ user: AuthUser }> = { success: true, data: { user } };
	res.status(201).json(body);
}

/** `POST /auth/login` */
export async function login(req: Request, res: Response): Promise<void> {
	const email = readBodyString(req.body?.email).trim().toLowerCase();
	const password = readBodyString(req.body?.password);

	if (!email || !password) {
		throw new HttpError('Email and password are required.', {
			status: 400,
			code: 'VALIDATION_ERROR'
		});
	}

	const { user, token } = await loginUser({ email, password });

	setSessionCookie(req, res, token);

	const body: ApiSuccess<{ user: AuthUser }> = { success: true, data: { user } };
	res.status(200).json(body);
}

/** `POST /auth/logout` */
export function logout(req: Request, res: Response): void {
	clearSessionCookie(req, res);

	const body: ApiSuccess<null> = { success: true, data: null };
	res.status(200).json(body);
}

/** `GET /auth/me` */
export async function me(req: Request, res: Response): Promise<void> {
	const user = await verifySession(readCookie(req, SESSION_COOKIE_NAME));

	if (!user) {
		throw new HttpError('Authentication required.', { status: 401, code: 'UNAUTHORIZED' });
	}

	res.setHeader('Cache-Control', 'no-store');

	const body: ApiSuccess<{ user: AuthUser }> = { success: true, data: { user } };
	res.status(200).json(body);
}
