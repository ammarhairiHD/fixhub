import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import {
  ACCOUNT_STATUSES,
  AI_SOURCES,
  CATEGORIES,
  DELIVERY_STATUSES,
  LOCATION_TYPES,
  NOTIFICATION_CHANNELS,
  PHOTO_KINDS,
  PRIORITIES,
  REMARK_VISIBILITIES,
  STATUSES,
  USER_ROLES,
} from "../shared/enums";
import { EMAIL_DOMAINS } from "../shared/constants";
import {
  COMMENT_MAX,
  DESC_MAX,
  DESC_MIN,
  PHOTO_MAX_BYTES,
  RATING_MAX,
  RATING_MIN,
} from "../shared/constants";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const asSqlNumber = (value: number) => sql.raw(String(value));
const enumSql = (values: readonly string[]) =>
  sql.raw(values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", "));
const emailDomainsSql = sql.raw(
  EMAIL_DOMAINS.map((domain) => `email LIKE '%${domain.replaceAll("'", "''")}'`).join(
    " OR ",
  ),
);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    passwordIterations: integer("password_iterations").notNull(),
    role: text("role", { enum: USER_ROLES }).notNull(),
    status: text("status", { enum: ACCOUNT_STATUSES }).notNull().default("Active"),
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(false),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: text("locked_until"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    check("users_password_iterations_positive", sql`${table.passwordIterations} > 0`),
    check("users_failed_login_count_nonnegative", sql`${table.failedLoginCount} >= 0`),
    check("users_role_valid", sql`${table.role} IN (${enumSql(USER_ROLES)})`),
    check(
      "users_status_valid",
      sql`${table.status} IN (${enumSql(ACCOUNT_STATUSES)})`,
    ),
    check("users_email_domain_valid", emailDomainsSql),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    lastSeen: text("last_seen").notNull().default(now),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export const locations = sqliteTable(
  "locations",
  {
    id: text("id").primaryKey(),
    building: text("building").notNull(),
    room: text("room").notNull(),
    locationType: text("location_type", { enum: LOCATION_TYPES }).notNull(),
    status: text("status", { enum: ACCOUNT_STATUSES }).notNull().default("Active"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("locations_building_room_unique").on(table.building, table.room),
    index("locations_status_idx").on(table.status),
    check(
      "locations_type_valid",
      sql`${table.locationType} IN (${enumSql(LOCATION_TYPES)})`,
    ),
    check(
      "locations_status_valid",
      sql`${table.status} IN (${enumSql(ACCOUNT_STATUSES)})`,
    ),
  ],
);

export const requests = sqliteTable(
  "requests",
  {
    id: text("id").primaryKey(),
    referenceNo: text("reference_no").notNull(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id),
    description: text("description").notNull(),
    category: text("category", { enum: CATEGORIES }).notNull(),
    priority: text("priority", { enum: PRIORITIES }).notNull(),
    status: text("status", { enum: STATUSES }).notNull().default("Submitted"),
    assignedTechnicianId: text("assigned_technician_id").references(() => users.id),
    resourceWasting: integer("resource_wasting", { mode: "boolean" })
      .notNull()
      .default(false),
    possibleDuplicateOf: text("possible_duplicate_of").references(
      (): AnySQLiteColumn => requests.id,
    ),
    reopenCount: integer("reopen_count").notNull().default(0),
    embedding: text("embedding"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
    completedAt: text("completed_at"),
    closedAt: text("closed_at"),
  },
  (table) => [
    uniqueIndex("requests_reference_no_unique").on(table.referenceNo),
    index("requests_reporter_id_idx").on(table.reporterId),
    index("requests_location_status_created_idx").on(
      table.locationId,
      table.status,
      table.createdAt,
    ),
    index("requests_assigned_technician_id_idx").on(table.assignedTechnicianId),
    check(
      "requests_description_length",
      sql`length(${table.description}) BETWEEN ${asSqlNumber(DESC_MIN)} AND ${asSqlNumber(DESC_MAX)}`,
    ),
    check("requests_reopen_count_nonnegative", sql`${table.reopenCount} >= 0`),
    check(
      "requests_category_valid",
      sql`${table.category} IN (${enumSql(CATEGORIES)})`,
    ),
    check(
      "requests_priority_valid",
      sql`${table.priority} IN (${enumSql(PRIORITIES)})`,
    ),
    check("requests_status_valid", sql`${table.status} IN (${enumSql(STATUSES)})`),
    check(
      "requests_embedding_json",
      sql`${table.embedding} IS NULL OR json_valid(${table.embedding})`,
    ),
  ],
);

export const aiSuggestions = sqliteTable(
  "ai_suggestions",
  {
    requestId: text("request_id")
      .primaryKey()
      .references(() => requests.id),
    suggestedCategory: text("suggested_category", { enum: CATEGORIES }),
    suggestedPriority: text("suggested_priority", { enum: PRIORITIES }),
    confidence: real("confidence"),
    source: text("source", { enum: AI_SOURCES }).notNull(),
    overridden: integer("overridden", { mode: "boolean" }).notNull().default(false),
    model: text("model"),
    responseMs: integer("response_ms"),
  },
  (table) => [
    check(
      "ai_suggestions_confidence_range",
      sql`${table.confidence} IS NULL OR ${table.confidence} BETWEEN 0 AND 1`,
    ),
    check(
      "ai_suggestions_response_ms_nonnegative",
      sql`${table.responseMs} IS NULL OR ${table.responseMs} >= 0`,
    ),
    check(
      "ai_suggestions_category_valid",
      sql`${table.suggestedCategory} IS NULL OR ${table.suggestedCategory} IN (${enumSql(CATEGORIES)})`,
    ),
    check(
      "ai_suggestions_priority_valid",
      sql`${table.suggestedPriority} IS NULL OR ${table.suggestedPriority} IN (${enumSql(PRIORITIES)})`,
    ),
    check(
      "ai_suggestions_source_valid",
      sql`${table.source} IN (${enumSql(AI_SOURCES)})`,
    ),
  ],
);

export const statusHistory = sqliteTable(
  "status_history",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id),
    previousStatus: text("previous_status", { enum: STATUSES }),
    newStatus: text("new_status", { enum: STATUSES }).notNull(),
    changedField: text("changed_field"),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    changedBy: text("changed_by").references(() => users.id),
    changedAt: text("changed_at").notNull().default(now),
    remark: text("remark"),
    remarkVisibility: text("remark_visibility", { enum: REMARK_VISIBILITIES }),
  },
  (table) => [
    index("status_history_request_changed_at_idx").on(table.requestId, table.changedAt),
    index("status_history_changed_by_idx").on(table.changedBy),
    check(
      "status_history_previous_status_valid",
      sql`${table.previousStatus} IS NULL OR ${table.previousStatus} IN (${enumSql(STATUSES)})`,
    ),
    check(
      "status_history_new_status_valid",
      sql`${table.newStatus} IN (${enumSql(STATUSES)})`,
    ),
    check(
      "status_history_visibility_valid",
      sql`${table.remarkVisibility} IS NULL OR ${table.remarkVisibility} IN (${enumSql(REMARK_VISIBILITIES)})`,
    ),
  ],
);

export const followers = sqliteTable(
  "followers",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    followedAt: text("followed_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("followers_request_user_unique").on(table.requestId, table.userId),
    index("followers_user_id_idx").on(table.userId),
  ],
);

export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id),
    uploaderId: text("uploader_id")
      .notNull()
      .references(() => users.id),
    photoType: text("photo_type", { enum: PHOTO_KINDS }).notNull(),
    fileFormat: text("file_format", { enum: ["image/jpeg", "image/png"] }).notNull(),
    fileSize: integer("file_size").notNull(),
    storagePath: text("storage_path").notNull(),
    uploadedAt: text("uploaded_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("photos_request_type_unique").on(table.requestId, table.photoType),
    check(
      "photos_file_size_limit",
      sql`${table.fileSize} BETWEEN 1 AND ${asSqlNumber(PHOTO_MAX_BYTES)}`,
    ),
    check("photos_kind_valid", sql`${table.photoType} IN (${enumSql(PHOTO_KINDS)})`),
    check(
      "photos_format_valid",
      sql`${table.fileFormat} IN ('image/jpeg', 'image/png')`,
    ),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => users.id),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id),
    message: text("message").notNull(),
    channel: text("channel", { enum: NOTIFICATION_CHANNELS }).notNull(),
    deliveryStatus: text("delivery_status", { enum: DELIVERY_STATUSES })
      .notNull()
      .default("Sent"),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    index("notifications_recipient_created_idx").on(table.recipientId, table.createdAt),
    index("notifications_request_id_idx").on(table.requestId),
    check(
      "notifications_channel_valid",
      sql`${table.channel} IN (${enumSql(NOTIFICATION_CHANNELS)})`,
    ),
    check(
      "notifications_delivery_status_valid",
      sql`${table.deliveryStatus} IN (${enumSql(DELIVERY_STATUSES)})`,
    ),
  ],
);

export const feedback = sqliteTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("feedback_request_id_unique").on(table.requestId),
    check(
      "feedback_rating_range",
      sql`${table.rating} BETWEEN ${asSqlNumber(RATING_MIN)} AND ${asSqlNumber(RATING_MAX)}`,
    ),
    check(
      "feedback_comment_length",
      sql`${table.comment} IS NULL OR length(${table.comment}) <= ${asSqlNumber(COMMENT_MAX)}`,
    ),
  ],
);

export const schema = {
  users,
  sessions,
  locations,
  requests,
  aiSuggestions,
  statusHistory,
  followers,
  photos,
  notifications,
  feedback,
} as const;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type MaintenanceRequest = typeof requests.$inferSelect;
export type NewMaintenanceRequest = typeof requests.$inferInsert;
