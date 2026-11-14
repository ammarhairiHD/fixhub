import { Hono } from "hono";

const app = new Hono();

app.get("/api/health", (context) => context.json({ status: "ok" }));

export async function scheduled(): Promise<void> {
  // Scheduled work is added with FR-33 and FR-29 implementation.
}

export { app };

export default {
  fetch: app.fetch,
  scheduled,
};
