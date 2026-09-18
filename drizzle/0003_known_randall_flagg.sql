CREATE TABLE `email_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`email` text NOT NULL,
	`expected_hash` text NOT NULL,
	`expires` integer NOT NULL,
	`consumed_by` text
);
--> statement-breakpoint
CREATE INDEX `idx_email_tokens_user` ON `email_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_email_tokens_expiry` ON `email_tokens` (`expires`);--> statement-breakpoint
ALTER TABLE `accounts` ADD `email` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `email_verified` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);