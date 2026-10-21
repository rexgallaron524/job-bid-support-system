CREATE TABLE users (
 id text PRIMARY KEY, email text NOT NULL UNIQUE CHECK (email = lower(email)),
 name text NOT NULL, password_hash text NOT NULL,
 role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','manager')),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
 theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light')), created_at text NOT NULL
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE jobs (
 id text PRIMARY KEY, short_id text NOT NULL CONSTRAINT jobs_short_id_unique UNIQUE,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 url text NOT NULL, canonical_url text NOT NULL, canonical_hash text NOT NULL, company text NOT NULL, title text NOT NULL,
 location text NOT NULL DEFAULT '', work_mode text NOT NULL DEFAULT 'Unspecified'
 CHECK (work_mode IN ('Unspecified','Remote','Hybrid','On-site')),
 salary text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'Saved' CHECK (status IN ('Saved','Preparing','Applied','Interview','Offer','Rejected','Withdrawn')),
 deadline text, applied_at text, resume_key text, resume_name text, resume_type text,
 resume_size integer CHECK (resume_size BETWEEN 1 AND 10485760), created_at text NOT NULL, updated_at text NOT NULL
);
CREATE UNIQUE INDEX jobs_owner_url ON jobs(user_id, canonical_hash);
CREATE INDEX jobs_owner_updated ON jobs(user_id, updated_at);
CREATE TABLE resumes (
 job_id text PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
 data bytea NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 10485760)
);
CREATE TABLE auth_limits (key text PRIMARY KEY, count integer NOT NULL, resets_at timestamptz NOT NULL);

