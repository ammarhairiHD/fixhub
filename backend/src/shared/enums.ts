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
