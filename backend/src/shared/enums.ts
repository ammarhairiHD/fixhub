export const CATEGORIES = [
  "Electrical",
  "Plumbing and Water",
  "Air-conditioning",
  "Furniture and Civil",
  "ICT/AV Equipment",
  "Cleanliness",
  "Others",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;

export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = [
  "Submitted",
  "Verified",
  "Assigned",
  "In Progress",
  "Completed",
  "Closed",
  "Rejected",
  "Cancelled",
] as const;

export type Status = (typeof STATUSES)[number];

export const LOCATION_TYPES = ["Academic", "Residential", "Common area"] as const;

export type LocationType = (typeof LOCATION_TYPES)[number];

export const AI_SOURCES = ["ai", "keyword", "manual"] as const;

export type AiSource = (typeof AI_SOURCES)[number];

export const REMARK_VISIBILITIES = ["reporter", "staff"] as const;

export type RemarkVisibility = (typeof REMARK_VISIBILITIES)[number];

export const USER_ROLES = ["REPORTER", "ADMIN", "TECHNICIAN"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ACCOUNT_STATUSES = ["Active", "Inactive"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const PHOTO_KINDS = ["Report", "Completion"] as const;

export type PhotoKind = (typeof PHOTO_KINDS)[number];

export const NOTIFICATION_CHANNELS = ["In-app", "Email"] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const DELIVERY_STATUSES = ["Sent", "Failed"] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
