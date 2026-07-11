import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "./schema.js";

// Das Ausrufezeichen wurde durch %21 ersetzt
const connectionString = "postgresql://postgres:23112020Ayleen%21@db.jqmktlrythfmsxzevkjt.supabase.co:6543/postgres";

// Erstelle den Client mit Konfiguration
const client = postgres(connectionString, { prepare: false });

// Korrekte Übergabe
export const db = drizzle(client, { schema });