import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt. Admin-Login wird nicht funktionieren."
  );
}

export const supabaseAdmin = createClient(supabaseUrl ?? "", serviceRoleKey ?? "", {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Für Benutzername-Logins wird intern eine "unsichtbare" E-Mail-Adresse gebaut,
// da Supabase Auth technisch eine E-Mail für jeden Account verlangt.
export const USERNAME_EMAIL_SUFFIX = "@bahamamamas.internal";

export function usernameToEmail(username: string) {
  return `${username}${USERNAME_EMAIL_SUFFIX}`;
}

export function emailToUsername(email: string, appMetadata: Record<string, any> | undefined | null) {
  if (appMetadata && typeof appMetadata.username === "string" && appMetadata.username) {
    return appMetadata.username;
  }
  return email && email.endsWith(USERNAME_EMAIL_SUFFIX)
    ? email.slice(0, -USERNAME_EMAIL_SUFFIX.length)
    : email || "";
}

// Alle steuerbaren Bereiche der Seite. Jeder Bereich kann pro Nutzer auf
// "none" (Standard, nicht sichtbar), "view" (nur sehen) oder "edit"
// (sehen + bearbeiten) stehen.
export const CATEGORIES = [
  "applications",
  "contacts",
  "team",
  "menu",
  "events",
  "vip",
  "finance",
  "info",
  "content",
  "users",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type AccessLevel = "none" | "view" | "edit";
export type PermissionMap = Partial<Record<Category, AccessLevel>>;

type SupabaseUser = NonNullable<
  Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>["data"]["user"]
>;

const CATEGORY_LABELS: Record<Category, string> = {
  applications: "Bewerbungen",
  contacts: "Kontaktanfragen",
  team: "Team",
  menu: "Lager & Preisliste",
  events: "Events",
  vip: "VIP-Tickets",
  finance: "Finanzen",
  info: "Wichtige Infos",
  content: "Inhalte & Felder",
  users: "Nutzer verwalten",
};

export function categoryLabel(category: Category) {
  return CATEGORY_LABELS[category] || category;
}

export function getPermissions(user: SupabaseUser): PermissionMap {
  const meta = (user.app_metadata || {}) as Record<string, any>;

  if (meta.permissions && typeof meta.permissions === "object" && !Array.isArray(meta.permissions)) {
    const result: PermissionMap = {};
    for (const category of CATEGORIES) {
      const level = meta.permissions[category];
      if (level === "view" || level === "edit") result[category] = level;
    }
    return result;
  }

  // Legacy-Accounts (nur { role: "admin" }, keine explizite Aufteilung) =>
  // voller Zugriff auf alles, damit bestehende Logins nicht abbrechen.
  if (meta.role === "admin") {
    const result: PermissionMap = {};
    for (const category of CATEGORIES) result[category] = "edit";
    return result;
  }

  return {};
}

function levelSatisfies(level: AccessLevel | undefined, required: "view" | "edit") {
  if (!level || level === "none") return false;
  if (required === "view") return level === "view" || level === "edit";
  return level === "edit";
}

async function authenticate(req: VercelRequest, res: VercelResponse): Promise<SupabaseUser | null> {
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

  return data.user;
}

/** Nur eingeloggt sein reicht (z.B. eigenes Passwort ändern, Grundinfos laden). */
export async function requireLogin(req: VercelRequest, res: VercelResponse) {
  return authenticate(req, res);
}

/**
 * "Weiche" Variante ohne Fehlerantwort - für öffentliche Endpunkte, die je
 * nach Login unterschiedlich viele Daten zeigen (z.B. Speisekarte: Gäste
 * sehen Preise, Mitarbeiter mit Rechten sehen zusätzlich Lagerdaten).
 * Gibt bei fehlendem/ungültigem Token einfach ein leeres Rechte-Objekt zurück.
 */
export async function getPermissionsFromRequest(req: VercelRequest): Promise<PermissionMap> {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return {};

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return {};

  return getPermissions(data.user);
}

export function hasLevel(level: AccessLevel | undefined, required: "view" | "edit") {
  return levelSatisfies(level, required);
}

/**
 * Prüft Login + eine bestimmte Mindest-Berechtigung ("view" oder "edit") für
 * einen Bereich. Schreibt bei fehlender Berechtigung direkt 401/403 auf
 * `res` und gibt `null` zurück - der Aufrufer muss dann nur `return` machen.
 */
export async function requirePermission(
  req: VercelRequest,
  res: VercelResponse,
  category: Category,
  required: "view" | "edit" = "edit"
): Promise<SupabaseUser | null> {
  const user = await authenticate(req, res);
  if (!user) return null;

  const permissions = getPermissions(user);
  if (!levelSatisfies(permissions[category], required)) {
    res.status(403).json({ error: `Keine Berechtigung für "${categoryLabel(category)}".` });
    return null;
  }

  return user;
}
