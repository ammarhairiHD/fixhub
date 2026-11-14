import { Hono } from "hono";
import { authRoutes } from "./routes/auth";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.get("/api/health", (context) => context.json({ status: "ok" }));
app.route("/api/auth", authRoutes);

export async function scheduled(): Promise<void> {
  // Scheduled work is added with FR-33 and FR-29 implementation.
}

export { app };

export default {
  fetch: app.fetch,
  scheduled,
};
