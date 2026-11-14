export const EMAIL_DOMAINS = ["@uitm.edu.my", "@student.uitm.edu.my"] as const;
export const PASSWORD_MIN = 8;
export const PASSWORD_PBKDF2_ITERATIONS = 50_000;
export const LOCK_AFTER = 5;
export const LOCK_MINUTES = 15;
export const IDLE_TIMEOUT_MIN = 30;

export const DESC_MIN = 10;
export const DESC_MAX = 500;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png"] as const;
export const REPORT_PHOTO_MAX = 1;
export const COMPLETION_PHOTO_MAX = 1;

export const AI_CONFIDENCE_MIN = 0.5;
export const SIMILARITY_MIN = 0.75;
export const SIMILAR_MAX_SHOWN = 3;
export const SIMILAR_COMPARE_MAX = 50;
export const AI_TIMEOUT_MS = 5000;

export const CONFIRM_WINDOW_DAYS = 7;
export const REMARK_MIN = 10;
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const COMMENT_MAX = 300;
export const OVERDUE_HOURS = 24;
export const OVERDUE_CRITICAL_HOURS = 2;
export const HOTSPOT_MIN = 3;
export const HOTSPOT_WINDOW_DAYS = 30;
export const REFERENCE_PREFIX = "FH";
export const REFERENCE_FORMAT = "FH-YYYY-NNNN";
export const REFERENCE_YEAR_DIGITS = 4;
export const REFERENCE_SEQUENCE_DIGITS = 4;
export const EMAIL_RETRIES = 3;
