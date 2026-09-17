CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`teacher` text NOT NULL,
	`code` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classes_code_unique` ON `classes` (`code`);--> statement-breakpoint
CREATE INDEX `idx_classes_teacher` ON `classes` (`teacher`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`class_id` text,
	`gear` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`class_id` text,
	`region` integer NOT NULL,
	`questions` text NOT NULL,
	`answers` text DEFAULT '[]' NOT NULL,
	`step` integer DEFAULT 0 NOT NULL,
	`started` integer NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL,
	`done` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_runs_user` ON `runs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_class_region` ON `runs` (`class_id`,`region`,`done`);