import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/**
 * Ensures the dedicated test database exists, matches the Prisma schema and is
 * seeded. Shared by the Vitest integration setup and the Playwright E2E setup.
 *
 * Returns the resolved DATABASE_URL so callers can propagate it to child
 * processes (e.g. Playwright's webServer).
 */
export async function prepareTestDatabase(envPath = ".env.test"): Promise<string> {
  config({ path: envPath, override: true });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error(`DATABASE_URL is not set (${envPath})`);

  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, "");
  if (!dbName) throw new Error(`Cannot determine database name from ${url}`);

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const exists = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  const env = { ...process.env, DATABASE_URL: url };
  run("node_modules/.bin/prisma", ["db", "push"], env);

  // Seed only when the demo tenant is missing. The integration tests create
  // their own fixtures, so re-seeding on every run only adds I/O.
  const check = new Client({ connectionString: url });
  await check.connect();
  try {
    const row = await check.query(`SELECT 1 FROM "Tenant" WHERE slug = 'zahra-fashion' LIMIT 1`);
    if (row.rowCount === 0) {
      run("node_modules/.bin/tsx", ["prisma/seed.ts"], env);
    }
  } finally {
    await check.end();
  }

  return url;
}

/** Runs a tool directly (avoids `npx` bootstrap processes) and surfaces output on failure. */
function run(binPath: string, args: string[], env: NodeJS.ProcessEnv) {
  const bin = fileURLToPath(new URL(`../${binPath}`, import.meta.url));
  try {
    execFileSync(bin, args, { env, cwd: ROOT, stdio: "pipe", timeout: 120_000 });
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; status?: number };
    const out = `${e.stdout?.toString() ?? ""}${e.stderr?.toString() ?? ""}`;
    throw new Error(`Command failed (${bin} ${args.join(" ")}):\n${out}`);
  }
}
