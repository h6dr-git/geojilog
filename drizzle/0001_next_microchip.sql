CREATE TABLE `savings_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`category` varchar(50) NOT NULL,
	`ticker` varchar(20) NOT NULL,
	`originalAmount` int NOT NULL,
	`actualAmount` int NOT NULL,
	`profit` int NOT NULL,
	`aiEstimated` enum('yes','no') NOT NULL DEFAULT 'no',
	`aiReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `savings_entries_id` PRIMARY KEY(`id`)
);
