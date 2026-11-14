import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendDir = dirname(scriptDir);
const sqlFile = join(backendDir, ".wrangler/backfill-embeddings.sql");
const model = "@cf/baai/bge-m3";

function loadDevVars() {
  const varsPath = join(backendDir, ".dev.vars");
  if (!existsSync(varsPath)) return;

  for (const rawLine of readFileSync(varsPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    process.env[name] ??= value;
  }
}

function executeWrangler(args, captureOutput = false) {
  const result = spawnSync(
    "wrangler",
    ["d1", "execute", "DB", "--local", "--config", "wrangler.jsonc", ...args],
    {
      cwd: backendDir,
      encoding: "utf8",
      stdio: captureOutput ? ["ignore", "pipe", "pipe"] : "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Local D1 command failed with exit code ${result.status}: ${result.stderr ?? ""}`,
    );
  }
  return result.stdout ?? "";
}

function parseRows(output) {
  const parsed = JSON.parse(output);
  const resultSets = Array.isArray(parsed) ? parsed : [parsed];
  return resultSets.flatMap((result) =>
    Array.isArray(result.results) ? result.results : [],
  );
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function requestEmbeddings(rows, accountId, apiToken) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: rows.map((row) => row.description) }),
    },
  );
  if (!response.ok) {
    throw new Error(`Workers AI returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  const vectors = payload?.result?.data ?? payload?.result?.response;
  if (
    !Array.isArray(vectors) ||
    vectors.length !== rows.length ||
    vectors.some(
      (vector) =>
        !Array.isArray(vector) ||
        vector.length === 0 ||
        vector.some((value) => typeof value !== "number" || !Number.isFinite(value)),
    )
  ) {
    throw new Error("Workers AI returned an invalid embedding response");
  }
  return vectors;
}

async function main() {
  loadDevVars();
  const batchSize = Number(process.env.EMBEDDING_BATCH_SIZE ?? "10");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) {
    throw new Error("EMBEDDING_BATCH_SIZE must be an integer from 1 to 50");
  }

  const query = `SELECT id, description FROM requests WHERE embedding IS NULL ORDER BY created_at LIMIT ${batchSize};`;
  const rows = parseRows(executeWrangler(["--json", "--command", query], true));
  if (rows.length === 0) {
    console.info("No requests need embeddings.");
    return;
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error(
      "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in the environment or backend/.dev.vars",
    );
  }

  const vectors = await requestEmbeddings(rows, accountId, apiToken);
  const updates = rows.map(
    (row, index) =>
      `UPDATE requests SET embedding = ${quote(JSON.stringify(vectors[index]))} WHERE id = ${quote(row.id)} AND embedding IS NULL;`,
  );
  mkdirSync(dirname(sqlFile), { recursive: true });
  writeFileSync(sqlFile, `BEGIN TRANSACTION;\n${updates.join("\n")}\nCOMMIT;\n`);

  try {
    executeWrangler(["--file", ".wrangler/backfill-embeddings.sql"]);
  } finally {
    rmSync(sqlFile, { force: true });
  }

  console.info(`Backfilled ${rows.length} request embeddings with ${model}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
