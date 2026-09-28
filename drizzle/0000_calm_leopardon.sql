CREATE TABLE `events` (
	`session` text NOT NULL,
	`name` text NOT NULL,
	`project` text NOT NULL,
	`day` text NOT NULL,
	`created` integer NOT NULL,
	PRIMARY KEY(`session`, `name`, `project`, `day`)
);
--> statement-breakpoint
CREATE INDEX `events_day` ON `events` (`day`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`session` text NOT NULL,
	`project` text NOT NULL,
	`created` integer NOT NULL,
	PRIMARY KEY(`session`, `project`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created` integer NOT NULL,
	`seen` integer NOT NULL
);
