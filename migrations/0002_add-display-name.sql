-- Migration number: 0002 	 2026-10-17T00:00:00.000Z
ALTER TABLE users ADD COLUMN display_name TEXT;

-- Existing accounts default to their email address as the account name.
UPDATE users SET display_name = email WHERE display_name IS NULL;

CREATE UNIQUE INDEX idx_users_display_name
	ON users(display_name);