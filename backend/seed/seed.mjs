import { randomBytes, webcrypto } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendDir = dirname(scriptDir);
const locations = JSON.parse(
  readFileSync(join(backendDir, "data/locations_seed.json"), "utf8"),
);
const sqlFile = join(backendDir, ".wrangler/seed-data.sql");
const password = "Password123";
const passwordIterations = 100_000;
const statuses = [
  "Submitted",
  "Verified",
  "Assigned",
  "In Progress",
  "Completed",
  "Closed",
  "Rejected",
  "Cancelled",
];
const categories = [
  "Electrical",
  "Plumbing and Water",
  "Air-conditioning",
  "Furniture and Civil",
  "ICT/AV Equipment",
  "Cleanliness",
  "Others",
];
const priorities = ["Critical", "High", "Medium", "Low"];
const openStatuses = new Set(["Submitted", "Verified", "Assigned", "In Progress"]);
const transitions = {
  Submitted: ["Submitted"],
  Verified: ["Submitted", "Verified"],
  Assigned: ["Submitted", "Verified", "Assigned"],
  "In Progress": ["Submitted", "Verified", "Assigned", "In Progress"],
  Completed: ["Submitted", "Verified", "Assigned", "In Progress", "Completed"],
  Closed: ["Submitted", "Verified", "Assigned", "In Progress", "Completed", "Closed"],
  Rejected: ["Submitted", "Rejected"],
  Cancelled: ["Submitted", "Cancelled"],
};
const descriptions = {
  Electrical: [
    "Lampu koridor tidak menyala di aras dua.",
    "Exposed wire near the classroom wall socket.",
    "Kipas siling berbunyi kuat dan tidak berfungsi.",
  ],
  "Plumbing and Water": [
    "Paip sinki bocor dan air menitis tanpa henti.",
    "The toilet flush is broken in the east wing.",
    "Air bertakung di bawah paip tandas aras satu.",
  ],
  "Air-conditioning": [
    "Aircond bilik kuliah tidak sejuk selepas dihidupkan.",
    "The air-conditioning unit is leaking water.",
    "Penghawa dingin di makmal mengeluarkan bunyi kuat.",
  ],
  "Furniture and Civil": [
    "Kerusi kuliah patah dan tidak stabil untuk digunakan.",
    "A ceiling tile is loose above the seminar room.",
    "Pintu bilik sukar ditutup dan engselnya longgar.",
  ],
  "ICT/AV Equipment": [
    "Projektor tidak memaparkan imej semasa kelas.",
    "The lectern microphone has no audio output.",
    "Skrin paparan di makmal tidak dapat disambungkan.",
  ],
  Cleanliness: [
    "Tong sampah penuh dan kawasan perlu dibersihkan.",
    "The corridor floor is wet and needs cleaning.",
    "Terdapat sampah bertaburan di ruang rehat kolej.",
  ],
  Others: [
    "Papan tanda arah di lobi telah tertanggal.",
    "The notice board frame is damaged near the entrance.",
    "Pemegang pintu utama longgar dan perlu diperiksa.",
  ],
};

function quote(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insert(table, row) {
  const columns = Object.keys(row);
  const values = columns.map((column) => quote(row[column]));
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${values.join(", ")}) ON CONFLICT DO NOTHING;`;
}

async function hashPassword() {
  const salt = randomBytes(16);
  const key = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await webcrypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: passwordIterations,
    },
    key,
    256,
  );

  return {
    password_hash: Buffer.from(derived).toString("base64"),
    password_salt: salt.toString("base64"),
    password_iterations: passwordIterations,
  };
}

function seedUsers(now) {
  const accounts = [
    {
      id: "seed-admin-001",
      full_name: "Seed Administrator",
      email: "seed.admin@uitm.edu.my",
      role: "ADMIN",
      must_change_password: true,
    },
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `seed-technician-${String(index + 1).padStart(3, "0")}`,
      full_name: `Seed Technician ${index + 1}`,
      email: `seed.technician${String(index + 1).padStart(2, "0")}@uitm.edu.my`,
      role: "TECHNICIAN",
      must_change_password: true,
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `seed-reporter-${String(index + 1).padStart(3, "0")}`,
      full_name: `Seed Reporter ${index + 1}`,
      email: `seed.reporter${String(index + 1).padStart(2, "0")}@student.uitm.edu.my`,
      role: "REPORTER",
      must_change_password: false,
    })),
  ];

  return Promise.all(
    accounts.map(async (account) =>
      insert("users", {
        ...account,
        ...await hashPassword(),
        status: "Active",
        failed_login_count: 0,
        locked_until: null,
        created_at: now,
        updated_at: now,
      }),
    ),
  );
}

function makeRequestRows(index, year, now) {
  const id = `seed-request-${String(index + 1).padStart(4, "0")}`;
  const previousId = `seed-request-${String(index).padStart(4, "0")}`;
  const reporterIndex = index % 5;
  const technicianIndex = index % 3;
  const status = statuses[index % statuses.length];
  const category = categories[(index * 3) % categories.length];
  const priority = priorities[(index * 5) % priorities.length];
  const source = ["ai", "keyword", "manual"][index % 3];
  const createdAt = new Date(
    now.getTime() -
      ((index * 37) % 90) * 24 * 60 * 60 * 1000 -
      ((index * 13) % 24) * 60 * 60 * 1000,
  );
  const path = transitions[status];
  const span = now.getTime() - createdAt.getTime();
  const times = path.map(
    (_, step) =>
      new Date(
        createdAt.getTime() +
          Math.floor((span * step) / Math.max(path.length - 1, 1)),
      ).toISOString(),
  );
  const assignedTechnicianId =
    ["Assigned", "In Progress", "Completed", "Closed"].includes(status)
      ? `seed-technician-${String(technicianIndex + 1).padStart(3, "0")}`
      : null;
  const locationIndex = (index * 17) % locations.length;
  const description =
    `${descriptions[category][index % descriptions[category].length]} ` +
    `(sample ${String(index + 1).padStart(3, "0")})`;
  const possibleDuplicateOf =
    index > 0 &&
    index % 19 === 0 &&
    openStatuses.has(status)
      ? previousId
      : null;
  const resourceWasting =
    ["Electrical", "Plumbing and Water", "Air-conditioning"].includes(category) &&
    index % 3 !== 0;
  const historyRows = path.map((newStatus, step) => {
    const previousStatus = step === 0 ? null : path[step - 1];
    const changedBy =
      newStatus === "Submitted" || newStatus === "Cancelled" || newStatus === "Closed"
        ? `seed-reporter-${String(reporterIndex + 1).padStart(3, "0")}`
        : ["In Progress", "Completed"].includes(newStatus)
          ? assignedTechnicianId
          : "seed-admin-001";
    const remark =
      newStatus === "Completed"
        ? "Repair completed and inspected."
        : newStatus === "Rejected"
          ? "Not a maintenance issue for campus facilities."
          : newStatus === "Cancelled"
            ? "Request cancelled by the reporter."
            : null;

    return {
      id: `${id}-history-${step + 1}`,
      request_id: id,
      previous_status: previousStatus,
      new_status: newStatus,
      changed_field: "status",
      old_value: previousStatus,
      new_value: newStatus,
      changed_by: changedBy,
      changed_at: times[step],
      remark,
      remark_visibility: remark ? "reporter" : null,
    };
  });
  const completedAt =
    historyRows.find((entry) => entry.new_status === "Completed")?.changed_at ?? null;
  const closedAt =
    historyRows.find((entry) => entry.new_status === "Closed")?.changed_at ?? null;
  const request = {
    id,
    reference_no: `FH-${year}-${String(index + 1).padStart(4, "0")}`,
    reporter_id: `seed-reporter-${String(reporterIndex + 1).padStart(3, "0")}`,
    location_id: `seed-location-${String(locationIndex + 1).padStart(3, "0")}`,
    description,
    category,
    priority,
    status,
    assigned_technician_id: assignedTechnicianId,
    resource_wasting: resourceWasting,
    possible_duplicate_of: possibleDuplicateOf,
    reopen_count: 0,
    embedding: null,
    created_at: createdAt.toISOString(),
    updated_at: times.at(-1),
    completed_at: completedAt,
    closed_at: closedAt,
  };
  const suggestion = {
    request_id: id,
    suggested_category: source === "manual" ? null : category,
    suggested_priority: source === "manual" ? null : priority,
    confidence: source === "ai" ? 0.55 + ((index * 11) % 45) / 100 : null,
    source,
    overridden: source === "ai" && index % 4 === 0,
    model: source === "ai" ? "@cf/meta/llama-3.3-70b-instruct-fp8-fast" : null,
    response_ms: source === "ai" ? 100 + ((index * 19) % 1200) : null,
  };
  const notification = {
    id: `${id}-notification`,
    recipient_id: request.reporter_id,
    request_id: id,
    message: `Sample request status: ${status}`,
    channel: "In-app",
    delivery_status: "Sent",
    is_read: index % 2 === 0,
    created_at: times.at(-1),
  };
  const feedbackRow =
    status === "Closed"
      ? {
          id: `${id}-feedback`,
          request_id: id,
          rating: (index % 5) + 1,
          comment: index % 2 === 0 ? "Sample feedback for local testing." : null,
          created_at: closedAt,
        }
      : null;
  const followerRow =
    openStatuses.has(status) && index % 6 === 0
      ? {
          id: `${id}-follower`,
          request_id: id,
          user_id: `seed-reporter-${String((reporterIndex + 1) % 5 + 1).padStart(3, "0")}`,
          followed_at: times.at(-1),
        }
      : null;

  return {
    request,
    suggestion,
    historyRows,
    notification,
    feedbackRow,
    followerRow,
  };
}

async function main() {
  if (locations.length !== 50) {
    throw new Error(`Expected 50 sample locations; found ${locations.length}`);
  }

  const now = new Date();
  const timestamp = now.toISOString();
  const year = now.getUTCFullYear();
  const statements = ["PRAGMA foreign_keys = ON;", "BEGIN TRANSACTION;"];

  statements.push(...await seedUsers(timestamp));
  locations.forEach((location, index) => {
    statements.push(
      insert("locations", {
        id: `seed-location-${String(index + 1).padStart(3, "0")}`,
        building: location.building,
        room: location.room,
        location_type: location.locationType,
        status: "Active",
        created_at: timestamp,
        updated_at: timestamp,
      }),
    );
  });

  const samples = Array.from({ length: 300 }, (_, index) =>
    makeRequestRows(index, year, now),
  );
  for (const sample of samples) {
    statements.push(insert("requests", sample.request));
  }
  for (const sample of samples) {
    statements.push(insert("ai_suggestions", sample.suggestion));
    sample.historyRows.forEach((entry) => statements.push(insert("status_history", entry)));
    statements.push(insert("notifications", sample.notification));
    if (sample.feedbackRow) statements.push(insert("feedback", sample.feedbackRow));
    if (sample.followerRow) statements.push(insert("followers", sample.followerRow));
  }
  statements.push("COMMIT;");

  mkdirSync(dirname(sqlFile), { recursive: true });
  writeFileSync(sqlFile, `${statements.join("\n")}\n`);

  try {
    const result = spawnSync(
      "wrangler",
      [
        "d1",
        "execute",
        "DB",
        "--local",
        "--config",
        "wrangler.jsonc",
        "--file",
        ".wrangler/seed-data.sql",
      ],
      { cwd: backendDir, encoding: "utf8" },
    );

    if (result.error) throw result.error;
    if (result.status !== 0) {
      if (result.stdout) process.stderr.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      throw new Error(`Local D1 seed failed with exit code ${result.status}`);
    }
  } finally {
    rmSync(sqlFile, { force: true });
  }

  console.info("Seeded 9 dummy users, 50 locations, and 300 sample requests.");
  console.info("All sample request embeddings are NULL; no photos or sessions were created.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
