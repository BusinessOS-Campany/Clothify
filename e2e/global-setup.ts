import { prepareTestDatabase } from "../tests/prepare-db";

/**
 * Playwright global setup: prepares the `clothify_test` database so the E2E
 * server (started by Playwright with the same DATABASE_URL) has demo data.
 */
export default async function setup() {
  await prepareTestDatabase();
}
