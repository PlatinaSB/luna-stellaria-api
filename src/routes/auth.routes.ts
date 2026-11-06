import { contentJson, fromHono, OpenAPIRoute } from 'chanfana';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.ts';
import { apiErrorResponse } from '../middleware/error-handler.ts';
import {
	changeDisplayName,
	changeEmail,
	changePassword,
	loginUser,
	registerUser
} from '../services/auth.service.ts';
import { verifyTurnstileToken } from '../services/turnstile.service.ts';
import { clearSessionCookie, setSessionCookie } from '../utils/cookies.ts';
import type { ApiSuccess, AuthUser } from '../types/index.ts';

export const authRouter = fromHono(new Hono());

/** Shared response schema for endpoints returning an account identity. */
const userEnvelope = z.object({
	success: z.literal(true),
	data: z.object({
		user: z.object({
			id: z.number(),
			email: z.string(),
			display_name: z.string()
		})
	})
});

/** Shared response schema for endpoints that carry no payload. */
const emptyEnvelope = z.object({
	success: z.literal(true),
	data: z.null()
});

/** Shared success response entry matching `userEnvelope`. */
const userResponse = (description: string) => ({
	description,
	content: { 'application/json': { schema: userEnvelope } }
});

/** Shared success response entry matching `emptyEnvelope`. */
const emptyResponse = (description: string) => ({
	description,
	content: { 'application/json': { schema: emptyEnvelope } }
});

const registerBody = z.object({
	email: z.string().email(),
	password: z.string().min(1),
	confirm_password: z.string().min(1),
	name: z.string().optional(),
	turnstile_token: z.string()
});

/** `POST /auth/register` */
class Register extends OpenAPIRoute {
	schema = {
		tags: ['Auth'],
		summary: 'Create a new account',
		request: { body: contentJson(registerBody) },
		responses: {
			'201': userResponse('Account created; a session cookie is set.'),
			'400': apiErrorResponse('Validation failure or Turnstile verification failed.'),
			'409': apiErrorResponse('Email or display name already in use.')
		}
	};

	async handle(c: Context): Promise<Response> {
		const { body } = await this.getValidatedData<typeof this.schema>();

		await verifyTurnstileToken(body.turnstile_token, c.req.header('cf-connecting-ip'));

		const { user, token } = await registerUser({
			email: body.email.trim().toLowerCase(),
			password: body.password,
			confirmPassword: body.confirm_password,
			displayName: body.name
		});

		setSessionCookie(c, token);

		const response: ApiSuccess<{ user: AuthUser }> = { success: true, data: { user } };
		return c.json(response, 201);
	}
}

const loginBody = z.object({
	email: z.string().email(),
	password: z.string().min(1),
	turnstile_token: z.string()
});

/** `POST /auth/login` */
class Login extends OpenAPIRoute {
	schema = {
		tags: ['Auth'],
		summary: 'Log in to an existing account',
		request: { body: contentJson(loginBody) },
		responses: {
			'200': userResponse('Session started; a session cookie is set.'),
			'400': apiErrorResponse('Validation failure or Turnstile verification failed.'),
			'401': apiErrorResponse('Invalid email or password.')
		}
	};

	async handle(c: Context): Promise<Response> {
		const { body } = await this.getValidatedData<typeof this.schema>();

		await verifyTurnstileToken(body.turnstile_token, c.req.header('cf-connecting-ip'));

		const { user, token } = await loginUser({
			email: body.email.trim().toLowerCase(),
			password: body.password
		});

		setSessionCookie(c, token);

		const response: ApiSuccess<{ user: AuthUser }> = { success: true, data: { user } };
		return c.json(response, 200);
	}
}

/** `POST /auth/logout` */
class Logout extends OpenAPIRoute {
	schema = {
		tags: ['Auth'],
		summary: 'Log out and clear the session cookie',
		responses: {
			'200': emptyResponse('Session cookie cleared.')
		}
	};

	async handle(c: Context): Promise<Response> {
		clearSessionCookie(c);

		const response: ApiSuccess<null> = { success: true, data: null };
		return c.json(response, 200);
	}
}

/** `GET /auth/me` */
class Me extends OpenAPIRoute {
	schema = {
		tags: ['Auth'],
		summary: 'Get the authenticated account',
		responses: {
			'200': userResponse('Current session identity.'),
			'401': apiErrorResponse('No valid session.')
		}
	};

	async handle(c: Context): Promise<Response> {
		const user = await requireAuth(c);

		c.header('Cache-Control', 'no-store');

		const response: ApiSuccess<{ user: AuthUser }> = { success: true, data: { user } };
		return c.json(response, 200);
	}
}

const renameBody = z.object({
	name: z.string().min(1)
});

/** `POST /auth/account/name` */
class RenameAccount extends OpenAPIRoute {
	schema = {
		tags: ['Auth'],
		summary: 'Change the display name',
		request: { body: contentJson(renameBody) },
		responses: {
			'200': userResponse('Display name updated.'),
			'400': apiErrorResponse('Validation failure (length limits).'),
			'401': apiErrorResponse('No valid session.'),
			'409': apiErrorResponse('Display name already in use.')
		}
	};

	async handle(c: Context): Promise<Response> {
		const { id } = await requireAuth(c);

		const { body } = await this.getValidatedData<typeof this.schema>();

		const user = await changeDisplayName(id, body.name);

		const response: ApiSuccess<{ user: AuthUser }> = { success: true, data: { user } };
		return c.json(response, 200);
	}
}

const changeEmailBody = z.object({
	current_password: z.string().min(1),
	email: z.string().email()
});

/** `POST /auth/account/email` */
class ChangeAccountEmail extends OpenAPIRoute {
	schema = {
		tags: ['Auth'],
		summary: 'Change the account email',
		request: { body: contentJson(changeEmailBody) },
		responses: {
			'200': userResponse('Email updated; a fresh session cookie is set.'),
			'400': apiErrorResponse('Validation failure.'),
			'401': apiErrorResponse('No valid session or wrong current password.'),
			'409': apiErrorResponse('Email already in use.')
		}
	};

	async handle(c: Context): Promise<Response> {
		const { id } = await requireAuth(c);

		const { body } = await this.getValidatedData<typeof this.schema>();

		const { user, token } = await changeEmail({
			userId: id,
			currentPassword: body.current_password,
			email: body.email.trim().toLowerCase()
		});

		// The session token embeds the email address, so reissue the cookie.
		setSessionCookie(c, token);

		const response: ApiSuccess<{ user: AuthUser }> = { success: true, data: { user } };
		return c.json(response, 200);
	}
}

const changePasswordBody = z.object({
	current_password: z.string().min(1),
	password: z.string().min(1),
	confirm_password: z.string().min(1)
});

/** `POST /auth/account/password` */
class ChangeAccountPassword extends OpenAPIRoute {
	schema = {
		tags: ['Auth'],
		summary: 'Change the account password',
		request: { body: contentJson(changePasswordBody) },
		responses: {
			'200': emptyResponse('Password updated.'),
			'400': apiErrorResponse('Validation failure.'),
			'401': apiErrorResponse('No valid session or wrong current password.')
		}
	};

	async handle(c: Context): Promise<Response> {
		const { id } = await requireAuth(c);

		const { body } = await this.getValidatedData<typeof this.schema>();

		await changePassword({
			userId: id,
			currentPassword: body.current_password,
			password: body.password,
			confirmPassword: body.confirm_password
		});

		const response: ApiSuccess<null> = { success: true, data: null };
		return c.json(response, 200);
	}
}

authRouter.post('/auth/register', Register);
authRouter.post('/auth/login', Login);
authRouter.post('/auth/logout', Logout);
authRouter.get('/auth/me', Me);

authRouter.post('/auth/account/name', RenameAccount);
authRouter.post('/auth/account/email', ChangeAccountEmail);
authRouter.post('/auth/account/password', ChangeAccountPassword);
