CREATE TABLE IF NOT EXISTS `entry_channels` (
	`session` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `entry_channels_created` ON `entry_channels` (`created`);