CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`url` text NOT NULL,
	`canonical_url` text NOT NULL,
	`company` text NOT NULL,
	`title` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`work_mode` text DEFAULT 'Unspecified' NOT NULL,
	`salary` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Saved' NOT NULL,
	`deadline` text,
	`applied_at` text,
	`resume_key` text,
	`resume_name` text,
	`resume_type` text,
	`resume_size` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_owner_url` ON `jobs` (`user_id`,`canonical_url`);--> statement-breakpoint
CREATE INDEX `jobs_owner_updated` ON `jobs` (`user_id`,`updated_at`);