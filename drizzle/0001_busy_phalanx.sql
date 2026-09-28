CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor` text NOT NULL,
	`project` text NOT NULL,
	`text` text NOT NULL,
	`created` integer NOT NULL,
	`resolved` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feedback_visitor` ON `feedback` (`visitor`,`created`);--> statement-breakpoint
CREATE TABLE `garden_feed` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor` text NOT NULL,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feed_created` ON `garden_feed` (`created`);--> statement-breakpoint
CREATE TABLE `journeys` (
	`visitor` text NOT NULL,
	`project` text NOT NULL,
	`visits` integer DEFAULT 0 NOT NULL,
	`opens` integer DEFAULT 0 NOT NULL,
	`last_visit` text DEFAULT '' NOT NULL,
	`last_open` text DEFAULT '' NOT NULL,
	`updated` integer NOT NULL,
	PRIMARY KEY(`visitor`, `project`)
);
--> statement-breakpoint
CREATE TABLE `owner_sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`epoch` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `presence` (
	`visitor` text PRIMARY KEY NOT NULL,
	`x` real DEFAULT 0 NOT NULL,
	`z` real DEFAULT 0 NOT NULL,
	`seen` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `presence_seen` ON `presence` (`seen`);--> statement-breakpoint
CREATE TABLE `reactions` (
	`visitor` text NOT NULL,
	`project` text NOT NULL,
	`value` integer NOT NULL,
	`updated` integer NOT NULL,
	PRIMARY KEY(`visitor`, `project`)
);
--> statement-breakpoint
CREATE TABLE `favorites_v2` (
	`visitor` text NOT NULL,
	`project` text NOT NULL,
	`created` integer NOT NULL,
	PRIMARY KEY(`visitor`, `project`)
);
--> statement-breakpoint
CREATE TABLE `visitors` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`alias` text NOT NULL,
	`color` text NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`seen` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `visitors_public_id_unique` ON `visitors` (`public_id`);