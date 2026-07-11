import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "./schema.js";

// Deine Verbindungs-URL für Supabase (Transaction Mode, Port 6543)
const connectionString = "postgresql://postgres:23112020Ayleen%21@db.jqmktlrythfmsxzevkjt.supabase.co:6543/postgres";

// Erstelle den Client
const client = postgres(connectionString, { prepare: false });

// Die Datenbank-Instanz exportieren
// 'as any' umgeht die Typ-Fehler während des Builds
export const db = drizzle(client as any, { schema });