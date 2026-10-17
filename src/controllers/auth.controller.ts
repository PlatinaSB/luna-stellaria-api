import type { Request, Response } from 'express';
import { HttpError } from '../middleware/error-handler.ts';
import { getAuthUser } from '../middleware/auth.ts';
import {
	changeDisplayName,
	changeEmail,
	changePassword,
	loginUser,
	registerUser,
	verifySession
} from '../services/auth.service.ts';
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
	const displayName = readBodyString(req.body?.name);

	if (!email || !password || !confirmPassword) {
		throw new HttpError('All fields are required.', { status: 400, code: 'VALIDATION_ERROR' });
	}

	const { user, token } = await registerUser({ email, password, confirmPassword, displayName });

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

/** `POST /auth/account/name` */
export async function renameAccount(req: Request, res: Response): Promise<void> {
	const { id } = getAuthUser(res);
	const name = readBodyString(req.body?.name);

	if (!name) {
		throw new HttpError('Name is required.', { status: 400, code: 'VALIDATION_ERROR' });
	}

	const user = await changeDisplayName(id, name);

	const body: ApiSuccess<{ user: AuthUser }> = { success: true, data: { user } };
	res.status(200).json(body);
}

/** `POST /auth/account/email` */
export async function changeAccountEmail(req: Request, res: Response): Promise<void> {
	const { id } = getAuthUser(res);
	const currentPassword = readBodyString(req.body?.current_password);
	const email = readBodyString(req.body?.email).trim().toLowerCase();

	if (!currentPassword || !email) {
		throw new HttpError('Current password and new email are required.', {
			status: 400,
			code: 'VALIDATION_ERROR'
		});
	}

	const { user, token } = await changeEmail({ userId: id, currentPassword, email });

	// The session token embeds the email address, so reissue the cookie.
	setSessionCookie(req, res, token);

	const body: ApiSuccess<{ user: AuthUser }> = { success: true, data: { user } };
	res.status(200).json(body);
}

/** `POST /auth/account/password` */
export async function changeAccountPassword(req: Request, res: Response): Promise<void> {
	const { id } = getAuthUser(res);
	const currentPassword = readBodyString(req.body?.current_password);
	const password = readBodyString(req.body?.password);
	const confirmPassword = readBodyString(req.body?.confirm_password);

	if (!currentPassword || !password || !confirmPassword) {
		throw new HttpError('Current password, new password and confirmation are required.', {
			status: 400,
			code: 'VALIDATION_ERROR'
		});
	}

	await changePassword({ userId: id, currentPassword, password, confirmPassword });

	const body: ApiSuccess<null> = { success: true, data: null };
	res.status(200).json(body);
}
