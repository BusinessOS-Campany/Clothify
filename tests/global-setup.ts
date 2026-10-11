import { prepareTestDatabase } from "./prepare-db";

/**
 * Vitest global setup: prepares the `clothify_test` database once per run.
 * Runs in its own process before any test workers start.
 */
export default async function setup() {
  await prepareTestDatabase();
}
