import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";
import type { D1Migration } from "@cloudflare/vitest-pool-workers/config";

declare const __D1_MIGRATIONS__: D1Migration[];

beforeAll(async () => {
  await applyD1Migrations(env.DB, __D1_MIGRATIONS__);
});
