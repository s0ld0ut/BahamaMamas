import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "./schema.js";

// Deine Verbindungs-URL für Supabase (Transaction Mode, Port 6543)
const connectionString = "postgresql://postgres:23112020Ayleen@db.jqmktlrythfmsxzevkjt.supabase.co:6543/postgres";

// Erstelle den Client mit Konfiguration für Vercel
const client = postgres(connectionString, { prepare: false });

// Korrekte Übergabe: Der client ist das erste Argument, das Schema das zweite
export const db = drizzle(client, { schema });