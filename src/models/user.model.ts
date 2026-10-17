import { env } from 'cloudflare:workers';
import type { AuthUser, UserRecord } from '../types/index.ts';

const USER_COLUMNS = 'id, email, password_hash';

/** Finds a user by email, including the password hash needed for login. */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
	return await env.lunadb
		.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ? LIMIT 1`)
		.bind(email)
		.first<UserRecord>();
}

/** Inserts a user and returns the persisted identity. */
export async function createUser(email: string, passwordHash: string): Promise<AuthUser> {
	const user = await env.lunadb
		.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id, email')
		.bind(email, passwordHash)
		.first<AuthUser>();

	if (!user) {
		throw new Error('Failed to create user.');
	}

	return user;
}
