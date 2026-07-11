import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "./schema.js";

// Wir nutzen hier process.env NUR als Backup, falls der String nicht direkt greift,
// aber der hart kodierte String MUSS Vorrang haben.
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:23112020Ayleen%21@db.jqmktlrythfmsxzevkjt.supabase.co:6543/postgres";

const client = postgres(connectionString, { 
  prepare: false,
  ssl: 'require' 
});

export const db = drizzle(client as any, { schema });