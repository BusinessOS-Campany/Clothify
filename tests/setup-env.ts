import { config } from "dotenv";

// Load test environment into the worker before any module reads
// process.env.DATABASE_URL (e.g. src/lib/db.ts).
config({ path: ".env.test", override: true });
