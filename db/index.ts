import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let connectionString = process.env.DATABASE_URL || "";

// Entfernt versehentlich mitkopierte Leerzeichen, Zeilenumbrüche oder
// Anführungszeichen rund um den String (häufiger Copy-Paste-Fehler).
connectionString = connectionString.trim();
if (
  (connectionString.startsWith('"') && connectionString.endsWith('"')) ||
  (connectionString.startsWith("'") && connectionString.endsWith("'"))
) {
  connectionString = connectionString.slice(1, -1).trim();
}

// Entfernt ein versehentlich mitkopiertes "DATABASE_URL=" am Anfang.
if (connectionString.toUpperCase().startsWith("DATABASE_URL=")) {
  connectionString = connectionString.slice("DATABASE_URL=".length).trim();
}

if (!connectionString) {
  throw new Error(
    "DATABASE_URL ist nicht gesetzt (die Umgebungsvariable ist leer oder fehlt komplett)."
  );
}

if (!/^postgres(ql)?:\/\//i.test(connectionString)) {
  // Zeigt sicher (ohne Passwort!) die ersten Zeichen, damit wir in den
  // Vercel-Logs sofort sehen können, was tatsächlich ankommt.
  const safePreview = connectionString.slice(0, 12).replace(/[a-zA-Z0-9]/g, "*");
  throw new Error(
    `DATABASE_URL scheint kein gültiger Postgres-Connection-String zu sein (beginnt nicht mit "postgresql://"). Vorschau der ersten Zeichen (maskiert): "${safePreview}...". Bitte den Wert in Vercel unter Environment Variables neu prüfen.`
  );
}

const client = postgres(connectionString, { prepare: false, ssl: "require" });

export const db = drizzle(client as any, { schema });
