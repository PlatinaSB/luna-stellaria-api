import { env } from 'cloudflare:workers';
import type { AuthUser, UserRecord } from '../types/index.ts';

const USER_COLUMNS = 'id, email, display_name, password_hash';

/** Finds a user by email, including the password hash needed for login. */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
	return await env.lunadb
		.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ? LIMIT 1`)
		.bind(email)
		.first<UserRecord>();
}

/** Finds a user by id, including the password hash needed for re-authentication. */
export async function findUserById(id: number): Promise<UserRecord | null> {
	return await env.lunadb
		.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`)
		.bind(id)
		.first<UserRecord>();
}

/** Finds the user holding a given display name, if any. */
export async function findUserByDisplayName(displayName: string): Promise<UserRecord | null> {
	return await env.lunadb
		.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE display_name = ? LIMIT 1`)
		.bind(displayName)
		.first<UserRecord>();
}

/** Inserts a user and returns the persisted identity. */
export async function createUser(
	email: string,
	passwordHash: string,
	displayName: string
): Promise<AuthUser> {
	const user = await env.lunadb
		.prepare(
			'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?) RETURNING id, email, display_name'
		)
		.bind(email, passwordHash, displayName)
		.first<AuthUser>();

	if (!user) {
		throw new Error('Failed to create user.');
	}

	return user;
}

/** Updates a user's email and returns the new persisted identity. */
export async function updateUserEmail(id: number, email: string): Promise<AuthUser> {
	const user = await env.lunadb
		.prepare('UPDATE users SET email = ? WHERE id = ? RETURNING id, email, display_name')
		.bind(email, id)
		.first<AuthUser>();

	if (!user) {
		throw new Error('Failed to update email.');
	}

	return user;
}

/** Updates a user's password hash. */
export async function updateUserPassword(id: number, passwordHash: string): Promise<void> {
	await env.lunadb
		.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
		.bind(passwordHash, id)
		.run();
}

/** Updates a user's display name and returns the new persisted identity. */
export async function updateUserDisplayName(id: number, displayName: string): Promise<AuthUser> {
	const user = await env.lunadb
		.prepare('UPDATE users SET display_name = ? WHERE id = ? RETURNING id, email, display_name')
		.bind(displayName, id)
		.first<AuthUser>();

	if (!user) {
		throw new Error('Failed to update display name.');
	}

	return user;
}
