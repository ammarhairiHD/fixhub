import type { UserRole } from "./shared/enums";

export interface WorkerBindings {
  DB: D1Database;
  PHOTOS: R2Bucket;
  AI: Ai;
  AI_CLASSIFIER_MODEL: string;
  EMAIL_PROVIDER: string;
}

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export type AppEnv = {
  Bindings: WorkerBindings;
  Variables: {
    authUser: AuthenticatedUser;
    sessionId: string;
  };
};
