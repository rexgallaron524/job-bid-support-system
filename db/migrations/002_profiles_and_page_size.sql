ALTER TABLE users ADD COLUMN application_page_size integer NOT NULL DEFAULT 10
 CHECK (application_page_size IN (10, 20, 50));

CREATE TABLE profiles (
 user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
 revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
 updated_at text NOT NULL
);
