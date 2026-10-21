CREATE TABLE job_activity (
 id text PRIMARY KEY,
 job_id text NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('saved','applied','interview_completed','offer','rejected','withdrawn')),
 occurred_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 120),
 notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
 source text NOT NULL DEFAULT 'recorded' CHECK (source IN ('recorded','backfill'))
);
CREATE INDEX job_activity_job_date ON job_activity(job_id, occurred_at);
CREATE UNIQUE INDEX job_activity_milestone ON job_activity(job_id, kind) WHERE kind <> 'interview_completed';

-- Only recover dates that the previous version actually recorded.
-- Interview/outcome dates cannot be inferred from a current status or updated_at.
INSERT INTO job_activity(id,job_id,kind,occurred_at,source)
 SELECT gen_random_uuid()::text,id,'saved',created_at::timestamptz,'backfill' FROM jobs;
INSERT INTO job_activity(id,job_id,kind,occurred_at,source)
 SELECT gen_random_uuid()::text,id,'applied',applied_at::timestamptz,'backfill' FROM jobs WHERE applied_at IS NOT NULL;
