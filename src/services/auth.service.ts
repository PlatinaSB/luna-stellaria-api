import { env } from 'cloudflare:workers';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { HttpError } from '../middleware/error-handler.ts';
import { createUser, findUserByEmail } from '../models/user.model.ts';
import type { AuthResult, AuthUser } from '../types/index.ts';

const JWT_ALGORITHM = 'HS256';
const SESSION_DURATION = '7d';
const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;

function getJwtSecret(): Uint8Array {
	const secret = env.JWT_SECRET;

	if (!secret) {
		throw new Error('JWT_SECRET is not configured.');
	}

	return new TextEncoder().encode(secret);
}

async function createSessionToken(user: AuthUser): Promise<string> {
	return await new SignJWT({ email: user.email })
		.setProtectedHeader({ alg: JWT_ALGORITHM, typ: 'JWT' })
		.setSubject(String(user.id))
		.setIssuedAt()
		.setExpirationTime(SESSION_DURATION)
		.sign(getJwtSecret());
}

/** Creates a new account and returns a signed session for it. */
export async function registerUser(input: {
	email: string;
	password: string;
	confirmPassword: string;
}): Promise<AuthResult> {
	const { email, password, confirmPassword } = input;

	if (password !== confirmPassword) {
		throw new HttpError('Passwords do not match.', {
			status: 400,
			code: 'VALIDATION_ERROR'
		});
	}

	if (password.length < MIN_PASSWORD_LENGTH) {
		throw new HttpError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, {
			status: 400,
			code: 'VALIDATION_ERROR'
		});
	}

	const existingUser = await findUserByEmail(email);

	if (existingUser) {
		throw new HttpError('An account with this email already exists.', {
			status: 409,
			code: 'EMAIL_TAKEN'
		});
	}

	const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
	const user = await createUser(email, passwordHash);
	const token = await createSessionToken(user);

	return { user, token };
}

/** Verifies credentials and returns a signed session. */
export async function loginUser(input: { email: string; password: string }): Promise<AuthResult> {
	const user = await findUserByEmail(input.email);

	if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
		throw new HttpError('Invalid email or password.', {
			status: 401,
			code: 'INVALID_CREDENTIALS'
		});
	}

	const identity: AuthUser = { id: user.id, email: user.email };
	const token = await createSessionToken(identity);

	return { user: identity, token };
}

/** Resolves a session token to a user, or `null` when it is missing or invalid. */
export async function verifySession(token: string | undefined | null): Promise<AuthUser | null> {
	if (!token) {
		return null;
	}

	try {
		const { payload } = await jwtVerify(token, getJwtSecret(), {
			algorithms: [JWT_ALGORITHM]
		});

		if (!payload.sub) {
			return null;
		}

		return { id: Number(payload.sub), email: String(payload.email ?? '') };
	} catch {
		return null;
	}
}
