import { env } from 'cloudflare:workers';
import argon2 from 'argon2';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { HttpError } from '../middleware/error-handler.ts';
import {
	createUser,
	findUserByEmail,
	findUserByDisplayName,
	findUserById,
	updateUserDisplayName,
	updateUserEmail,
	updateUserPassword
} from '../models/user.model.ts';
import type { AuthResult, AuthUser, UserRecord } from '../types/index.ts';

const JWT_ALGORITHM = 'HS256';
const SESSION_DURATION = '7d';
const MIN_PASSWORD_LENGTH = 8;
const MIN_DISPLAY_NAME_LENGTH = 2;
const MAX_DISPLAY_NAME_LENGTH = 40;
const DISPLAY_NAME_ATTEMPTS = 10;

const NAME_ADJECTIVES = [
	'Starry',
	'Lunar',
	'Solar',
	'Silent',
	'Brave',
	'Bright',
	'Swift',
	'Calm',
	'Cosmic',
	'Gentle'
];

const NAME_NOUNS = [
	'Fox',
	'Otter',
	'Raven',
	'Wolf',
	'Sparrow',
	'Deer',
	'Tiger',
	'Hare',
	'Falcon',
	'Panda'
];

function pick(list: string[]): string {
	return list[Math.floor(Math.random() * list.length)];
}

/** Generates an available, friendly pseudo name such as `StarryFox421`. */
async function generateDisplayName(): Promise<string> {
	for (let attempt = 0; attempt < DISPLAY_NAME_ATTEMPTS; attempt += 1) {
		const candidate = `${pick(NAME_ADJECTIVES)}${pick(NAME_NOUNS)}${Math.floor(100 + Math.random() * 900)}`;

		if (!(await findUserByDisplayName(candidate))) {
			return candidate;
		}
	}

	return `Stellar${Math.floor(1000000 + Math.random() * 9000000)}`;
}

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
	displayName?: string;
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

	const requestedName = input.displayName?.trim();

	if (requestedName) {
		await assertDisplayNameAvailable(requestedName, null);
	}

	const displayName = requestedName || (await generateDisplayName());

	const passwordHash = await argon2.hash(password);
	const user = await createUser(email, passwordHash, displayName);
	const token = await createSessionToken(user);

	return { user, token };
}

/**
 * Checks whether a password matches a stored hash.
 * - argon2 hashes start with $argon2id$ or $argon2i$
 * - bcrypt hashes start with $2a$, $2b$, or $2y$
 * On successful bcrypt verification, the hash is automatically rehashed to argon2
 * (transparent lazy migration of existing users). The rehash happens inside
 * loginUser/changeEmail/changePassword after the verification check passes,
 * to avoid double-hashing on concurrent requests.
 */
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	// argon2 hashes start with $argon2id$ or $argon2i$
	if (storedHash.startsWith('$argon2id$') || storedHash.startsWith('$argon2i$')) {
		return argon2.verify(storedHash, password);
	}

	// bcrypt hashes start with $2a$, $2b$, or $2y$
	if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
		const match = await bcrypt.compare(password, storedHash);
		if (match) {
			// Marker: caller (loginUser/changeEmail/changePassword) will rehash
			// to argon2 after this returns true.
			return true;
		}
		return false;
	}

	// Unknown hash format — reject
	return false;
}

/** Verifies credentials and returns a signed session. */
export async function loginUser(input: { email: string; password: string }): Promise<AuthResult> {
	const user = await findUserByEmail(input.email);

	if (!user) {
		throw new HttpError('Invalid email or password.', {
			status: 401,
			code: 'INVALID_CREDENTIALS'
		});
	}

	const passwordValid = await verifyPassword(input.password, user.password_hash);

	if (!passwordValid) {
		throw new HttpError('Invalid email or password.', {
			status: 401,
			code: 'INVALID_CREDENTIALS'
		});
	}

	// Transparently rehash bcrypt hashes to argon2 after successful verification
	if (user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$') || user.password_hash.startsWith('$2y$')) {
		const newHash = await argon2.hash(input.password);
		await updateUserPassword(user.id, newHash);
	}

	const identity = toAuthUser(user);
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

		// Resolve the persisted user so `display_name`, email, and existence are
		// always current instead of reflecting the token's snapshot.
		const record = await findUserById(Number(payload.sub));

		return record ? toAuthUser(record) : null;
	} catch {
		return null;
	}
}

/** Strips credential material from a persisted record. */
function toAuthUser(user: UserRecord): AuthUser {
	return { id: user.id, email: user.email, display_name: user.display_name };
}

/** Validates a display name and ensures no other account holds it. */
async function assertDisplayNameAvailable(name: string, userId: number | null): Promise<void> {
	if (name.length < MIN_DISPLAY_NAME_LENGTH || name.length > MAX_DISPLAY_NAME_LENGTH) {
		throw new HttpError(
			`Name must be between ${MIN_DISPLAY_NAME_LENGTH} and ${MAX_DISPLAY_NAME_LENGTH} characters.`,
			{ status: 400, code: 'VALIDATION_ERROR' }
		);
	}

	const existing = await findUserByDisplayName(name);

	if (existing && existing.id !== userId) {
		throw new HttpError('This name is already in use.', { status: 409, code: 'NAME_TAKEN' });
	}
}

/** Verifies an account name change and returns the updated identity. */
export async function changeDisplayName(userId: number, displayName: string): Promise<AuthUser> {
	const name = displayName.trim();

	await assertDisplayNameAvailable(name, userId);

	return await updateUserDisplayName(userId, name);
}

/**
 * Verifies an email change against the current password and returns a session
 * for the new email (the JWT embeds the email address, so it must be reissued).
 */
export async function changeEmail(input: {
	userId: number;
	currentPassword: string;
	email: string;
}): Promise<AuthResult> {
	const record = await findUserById(input.userId);

	if (!record) {
		throw new HttpError('Account not found.', { status: 404, code: 'NOT_FOUND' });
	}

	const passwordValid = await verifyPassword(input.currentPassword, record.password_hash);

	if (!passwordValid) {
		throw new HttpError('Current password is incorrect.', {
			status: 401,
			code: 'INVALID_CREDENTIALS'
		});
	}

	// Transparently rehash bcrypt hashes to argon2 after successful verification
	if (record.password_hash.startsWith('$2a$') || record.password_hash.startsWith('$2b$') || record.password_hash.startsWith('$2y$')) {
		const newHash = await argon2.hash(input.currentPassword);
		await updateUserPassword(record.id, newHash);
	}

	const email = input.email;
	const existingUser = await findUserByEmail(email);

	if (existingUser && existingUser.id !== input.userId) {
		throw new HttpError('An account with this email already exists.', {
			status: 409,
			code: 'EMAIL_TAKEN'
		});
	}

	const user = await updateUserEmail(input.userId, email);
	const token = await createSessionToken(user);

	return { user, token };
}

/** Verifies a password change against the current password. */
export async function changePassword(input: {
	userId: number;
	currentPassword: string;
	password: string;
	confirmPassword: string;
}): Promise<void> {
	const record = await findUserById(input.userId);

	if (!record) {
		throw new HttpError('Account not found.', { status: 404, code: 'NOT_FOUND' });
	}

	const passwordValid = await verifyPassword(input.currentPassword, record.password_hash);

	if (!passwordValid) {
		throw new HttpError('Current password is incorrect.', {
			status: 401,
			code: 'INVALID_CREDENTIALS'
		});
	}

	if (input.password !== input.confirmPassword) {
		throw new HttpError('Passwords do not match.', {
			status: 400,
			code: 'VALIDATION_ERROR'
		});
	}

	if (input.password.length < MIN_PASSWORD_LENGTH) {
		throw new HttpError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, {
			status: 400,
			code: 'VALIDATION_ERROR'
		});
	}

	const passwordHash = await argon2.hash(input.password);
	await updateUserPassword(input.userId, passwordHash);
}