import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL ist nicht gesetzt. Bitte in den Vercel-Projekteinstellungen (Settings -> Environment Variables) den Supabase-Postgres-Connection-String hinterlegen."
  );
}

// prepare: false ist wichtig für den Supabase "Transaction Pooler" (Port 6543 / PgBouncer),
// der keine vorbereiteten Anweisungen (prepared statements) unterstützt.
const client = postgres(connectionString, { prepare: false, ssl: "require" });

export const db = drizzle(client, { schema });
