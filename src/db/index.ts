import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set, copy .env.example to .env.local");

// `prepare: false` is required for transaction-pooled connections (Neon/PgBouncer).
const globalForDb = globalThis as unknown as { __wlClient?: ReturnType<typeof postgres> };
const client = globalForDb.__wlClient ?? postgres(url, { prepare: false, max: 5 });
if (process.env.NODE_ENV !== "production") globalForDb.__wlClient = client;

export const db = drizzle(client, { schema });
export { schema };
