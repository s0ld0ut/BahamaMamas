import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../db/index.js";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  // Wird beim ersten Funktionsaufruf sichtbar in den Vercel-Logs, falls die
  // Umgebungsvariablen fehlen.
  console.error(
    "SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt. Admin-Login wird nicht funktionieren."
  );
}

const supabaseAdmin = createClient(supabaseUrl ?? "", serviceRoleKey ?? "", {
  auth: { autoRefreshToken: false, persistSession: false },
});

type SupabaseUser = NonNullable<
  Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>["data"]["user"]
>;

function isAdmin(user: SupabaseUser) {
  const metadataRoles = Array.isArray(user.app_metadata?.roles)
    ? (user.app_metadata!.roles as unknown[])
    : [];
  return user.app_metadata?.role === "admin" || metadataRoles.includes("admin");
}

/**
 * Prüft den "Authorization: Bearer <supabase-access-token>" Header.
 * Schreibt bei fehlendem/ungültigem Login direkt die passende HTTP-Antwort
 * (401/403) auf `res` und gibt dann `null` zurück - der Aufrufer muss in
 * diesem Fall nur `return` ausführen. Bei Erfolg wird der Supabase-User
 * zurückgegeben.
 */
export async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<SupabaseUser | null> {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    res.status(401).json({ error: "Nicht eingeloggt." });
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    res.status(401).json({ error: "Nicht eingeloggt." });
    return null;
  }

  if (!isAdmin(data.user)) {
    res.status(403).json({ error: "Keine Admin-Berechtigung." });
    return null;
  }

  return data.user;
}
