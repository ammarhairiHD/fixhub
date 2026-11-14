import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function createReporter(id: string, email: string) {
  await env.DB.prepare(
    `INSERT INTO users (id, full_name, email, password_hash, password_salt, password_iterations, role)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, "Test Reporter", email, "hash", "salt", 1000, "REPORTER")
    .run();
}

describe("D1 schema", () => {
  it("creates all SRS Section 4.1 tables", async () => {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    ).all<{ name: string }>();

    expect(result.results.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        "users",
        "sessions",
        "locations",
        "requests",
        "ai_suggestions",
        "status_history",
        "followers",
        "photos",
        "notifications",
        "feedback",
      ]),
    );
  });

  it("fr01: enforces unique email addresses", async () => {
    const email = `unique-${crypto.randomUUID()}@student.uitm.edu.my`;
    await createReporter(crypto.randomUUID(), email);

    await expect(createReporter(crypto.randomUUID(), email)).rejects.toThrow();
  });

  it("fr07: enforces unique building and room pairs", async () => {
    const suffix = crypto.randomUUID();
    const insertLocation = (id: string) =>
      env.DB.prepare(
        "INSERT INTO locations (id, building, room, location_type) VALUES (?, ?, ?, ?)",
      )
        .bind(id, `Building ${suffix}`, "Room 1", "Academic")
        .run();

    await insertLocation(crypto.randomUUID());
    await expect(insertLocation(crypto.randomUUID())).rejects.toThrow();
  });

  it("fr11 and fr22: enforces unique references and request followers", async () => {
    const suffix = crypto.randomUUID();
    const reporterId = crypto.randomUUID();
    const locationId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const referenceNo = `FH-2099-${suffix.slice(0, 4)}`;

    await createReporter(reporterId, `request-${suffix}@uitm.edu.my`);
    await env.DB.prepare(
      "INSERT INTO locations (id, building, room, location_type) VALUES (?, ?, ?, ?)",
    )
      .bind(locationId, `Building ${suffix}`, "Room 1", "Academic")
      .run();

    const insertRequest = (id: string) =>
      env.DB.prepare(
        `INSERT INTO requests
         (id, reference_no, reporter_id, location_id, description, category, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          referenceNo,
          reporterId,
          locationId,
          "A sample fault description.",
          "Electrical",
          "Medium",
        )
        .run();

    await insertRequest(requestId);
    await expect(insertRequest(crypto.randomUUID())).rejects.toThrow();

    const followerId = crypto.randomUUID();
    const insertFollower = (id: string) =>
      env.DB.prepare(
        "INSERT INTO followers (id, request_id, user_id) VALUES (?, ?, ?)",
      )
        .bind(id, requestId, reporterId)
        .run();

    await insertFollower(followerId);
    await expect(insertFollower(crypto.randomUUID())).rejects.toThrow();
  });

  it("fr34: rejects feedback ratings outside one to five", async () => {
    const suffix = crypto.randomUUID();
    const reporterId = crypto.randomUUID();
    const locationId = crypto.randomUUID();
    const requestId = crypto.randomUUID();

    await createReporter(reporterId, `feedback-${suffix}@student.uitm.edu.my`);
    await env.DB.prepare(
      "INSERT INTO locations (id, building, room, location_type) VALUES (?, ?, ?, ?)",
    )
      .bind(locationId, `Building ${suffix}`, "Room 1", "Academic")
      .run();
    await env.DB.prepare(
      `INSERT INTO requests
       (id, reference_no, reporter_id, location_id, description, category, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        requestId,
        `FH-2099-${suffix.slice(0, 4)}`,
        reporterId,
        locationId,
        "A sample fault description.",
        "Electrical",
        "Medium",
      )
      .run();

    const insertRating = (rating: number) =>
      env.DB.prepare(
        "INSERT INTO feedback (id, request_id, rating) VALUES (?, ?, ?)",
      )
        .bind(crypto.randomUUID(), requestId, rating)
        .run();

    await expect(insertRating(6)).rejects.toThrow();
    await expect(insertRating(0)).rejects.toThrow();
  });
});
