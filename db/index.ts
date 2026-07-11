import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "./schema.js";

// Wir definieren den String hart
const connectionString = "postgresql://postgres:23112020Ayleen%21@db.jqmktlrythfmsxzevkjt.supabase.co:6543/postgres";

// Konfiguriere postgres explizit, um Umgebungs-Variablen zu ignorieren
const client = postgres(connectionString, { 
  prepare: false,
  ssl: 'require',
  max: 1 // Begrenze die Verbindungen für Serverless
});

export const db = drizzle(client as any, { schema });