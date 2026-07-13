import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let client;

if (process.env.PGHOST && process.env.PGPASSWORD) {
  // Einzelne Felder - das umgeht jegliche Encoding-Probleme im Connection-String.
  client = postgres({
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 6543,
    username: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || "postgres",
    ssl: "require",
    prepare: false,
  });
} else {
  throw new Error(
    "PGHOST oder PGPASSWORD ist nicht gesetzt. Bitte in Vercel unter Environment Variables anlegen."
  );
}

export const db = drizzle(client as any, { schema });
