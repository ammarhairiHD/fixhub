CREATE TABLE `ai_suggestions` (
	`request_id` text PRIMARY KEY NOT NULL,
	`suggested_category` text,
	`suggested_priority` text,
	`confidence` real,
	`source` text NOT NULL,
	`overridden` integer DEFAULT false NOT NULL,
	`model` text,
	`response_ms` integer,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ai_suggestions_confidence_range" CHECK("ai_suggestions"."confidence" IS NULL OR "ai_suggestions"."confidence" BETWEEN 0 AND 1),
	CONSTRAINT "ai_suggestions_response_ms_nonnegative" CHECK("ai_suggestions"."response_ms" IS NULL OR "ai_suggestions"."response_ms" >= 0),
	CONSTRAINT "ai_suggestions_category_valid" CHECK("ai_suggestions"."suggested_category" IS NULL OR "ai_suggestions"."suggested_category" IN ('Electrical', 'Plumbing and Water', 'Air-conditioning', 'Furniture and Civil', 'ICT/AV Equipment', 'Cleanliness', 'Others')),
	CONSTRAINT "ai_suggestions_priority_valid" CHECK("ai_suggestions"."suggested_priority" IS NULL OR "ai_suggestions"."suggested_priority" IN ('Critical', 'High', 'Medium', 'Low')),
	CONSTRAINT "ai_suggestions_source_valid" CHECK("ai_suggestions"."source" IN ('ai', 'keyword', 'manual'))
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "feedback_rating_range" CHECK("feedback"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "feedback_comment_length" CHECK("feedback"."comment" IS NULL OR length("feedback"."comment") <= 300)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_request_id_unique` ON `feedback` (`request_id`);--> statement-breakpoint
CREATE TABLE `followers` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`user_id` text NOT NULL,
	`followed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `followers_request_user_unique` ON `followers` (`request_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `followers_user_id_idx` ON `followers` (`user_id`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`building` text NOT NULL,
	`room` text NOT NULL,
	`location_type` text NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "locations_type_valid" CHECK("locations"."location_type" IN ('Academic', 'Residential', 'Common area')),
	CONSTRAINT "locations_status_valid" CHECK("locations"."status" IN ('Active', 'Inactive'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_building_room_unique` ON `locations` (`building`,`room`);--> statement-breakpoint
CREATE INDEX `locations_status_idx` ON `locations` (`status`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_id` text NOT NULL,
	`request_id` text NOT NULL,
	`message` text NOT NULL,
	`channel` text NOT NULL,
	`delivery_status` text DEFAULT 'Sent' NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "notifications_channel_valid" CHECK("notifications"."channel" IN ('In-app', 'Email')),
	CONSTRAINT "notifications_delivery_status_valid" CHECK("notifications"."delivery_status" IN ('Sent', 'Failed'))
);
--> statement-breakpoint
CREATE INDEX `notifications_recipient_created_idx` ON `notifications` (`recipient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_request_id_idx` ON `notifications` (`request_id`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`uploader_id` text NOT NULL,
	`photo_type` text NOT NULL,
	`file_format` text NOT NULL,
	`file_size` integer NOT NULL,
	`storage_path` text NOT NULL,
	`uploaded_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploader_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "photos_file_size_limit" CHECK("photos"."file_size" BETWEEN 1 AND 5242880),
	CONSTRAINT "photos_kind_valid" CHECK("photos"."photo_type" IN ('Report', 'Completion')),
	CONSTRAINT "photos_format_valid" CHECK("photos"."file_format" IN ('image/jpeg', 'image/png'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_request_type_unique` ON `photos` (`request_id`,`photo_type`);--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`reference_no` text NOT NULL,
	`reporter_id` text NOT NULL,
	`location_id` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`priority` text NOT NULL,
	`status` text DEFAULT 'Submitted' NOT NULL,
	`assigned_technician_id` text,
	`resource_wasting` integer DEFAULT false NOT NULL,
	`possible_duplicate_of` text,
	`reopen_count` integer DEFAULT 0 NOT NULL,
	`embedding` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`completed_at` text,
	`closed_at` text,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_technician_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`possible_duplicate_of`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "requests_description_length" CHECK(length("requests"."description") BETWEEN 10 AND 500),
	CONSTRAINT "requests_reopen_count_nonnegative" CHECK("requests"."reopen_count" >= 0),
	CONSTRAINT "requests_category_valid" CHECK("requests"."category" IN ('Electrical', 'Plumbing and Water', 'Air-conditioning', 'Furniture and Civil', 'ICT/AV Equipment', 'Cleanliness', 'Others')),
	CONSTRAINT "requests_priority_valid" CHECK("requests"."priority" IN ('Critical', 'High', 'Medium', 'Low')),
	CONSTRAINT "requests_status_valid" CHECK("requests"."status" IN ('Submitted', 'Verified', 'Assigned', 'In Progress', 'Completed', 'Closed', 'Rejected', 'Cancelled')),
	CONSTRAINT "requests_embedding_json" CHECK("requests"."embedding" IS NULL OR json_valid("requests"."embedding"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `requests_reference_no_unique` ON `requests` (`reference_no`);--> statement-breakpoint
CREATE INDEX `requests_reporter_id_idx` ON `requests` (`reporter_id`);--> statement-breakpoint
CREATE INDEX `requests_location_status_created_idx` ON `requests` (`location_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `requests_assigned_technician_id_idx` ON `requests` (`assigned_technician_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`last_seen` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`previous_status` text,
	`new_status` text NOT NULL,
	`changed_field` text,
	`old_value` text,
	`new_value` text,
	`changed_by` text,
	`changed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`remark` text,
	`remark_visibility` text,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "status_history_previous_status_valid" CHECK("status_history"."previous_status" IS NULL OR "status_history"."previous_status" IN ('Submitted', 'Verified', 'Assigned', 'In Progress', 'Completed', 'Closed', 'Rejected', 'Cancelled')),
	CONSTRAINT "status_history_new_status_valid" CHECK("status_history"."new_status" IN ('Submitted', 'Verified', 'Assigned', 'In Progress', 'Completed', 'Closed', 'Rejected', 'Cancelled')),
	CONSTRAINT "status_history_visibility_valid" CHECK("status_history"."remark_visibility" IS NULL OR "status_history"."remark_visibility" IN ('reporter', 'staff'))
);
--> statement-breakpoint
CREATE INDEX `status_history_request_changed_at_idx` ON `status_history` (`request_id`,`changed_at`);--> statement-breakpoint
CREATE INDEX `status_history_changed_by_idx` ON `status_history` (`changed_by`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_iterations` integer NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`must_change_password` integer DEFAULT false NOT NULL,
	`failed_login_count` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "users_password_iterations_positive" CHECK("users"."password_iterations" > 0),
	CONSTRAINT "users_failed_login_count_nonnegative" CHECK("users"."failed_login_count" >= 0),
	CONSTRAINT "users_role_valid" CHECK("users"."role" IN ('REPORTER', 'ADMIN', 'TECHNICIAN')),
	CONSTRAINT "users_status_valid" CHECK("users"."status" IN ('Active', 'Inactive')),
	CONSTRAINT "users_email_domain_valid" CHECK(email LIKE '%@uitm.edu.my' OR email LIKE '%@student.uitm.edu.my')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);