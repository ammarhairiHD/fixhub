declare module "cloudflare:test" {
  interface ProvidedEnv {
    DB: D1Database;
    PHOTOS: R2Bucket;
    AI: Ai;
    AI_CLASSIFIER_MODEL: string;
    EMAIL_PROVIDER: string;
  }
}

export {};
