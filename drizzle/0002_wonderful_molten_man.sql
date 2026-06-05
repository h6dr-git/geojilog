CREATE TABLE `user_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(50) NOT NULL,
	`color` varchar(30) NOT NULL DEFAULT 'gray',
	`isDefault` enum('yes','no') NOT NULL DEFAULT 'no',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_categories_id` PRIMARY KEY(`id`)
);
