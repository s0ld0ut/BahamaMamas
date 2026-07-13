import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { teamMembers } from "../db/schema.js";
import {
  CATEGORIES,
  emailToUsername,
  getPermissions,
  requirePermission,
  supabaseAdmin,
  usernameToEmail,
  type PermissionMap,
} from "./_lib/auth.js";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

// --- Team-Profile (öffentlich) ---

function cleanSortOrder(value: unknown) {
  const sortOrder = Number(value);
  return Number.isInteger(sortOrder) && sortOrder >= 0 && sortOrder <= 10000 ? sortOrder : null;
}

function validateMember(body: Record<string, unknown> | null) {
  const name = clean(body?.name);
  const role = clean(body?.role);
  const expertise = clean(body?.expertise);
  const description = clean(body?.description);
  const sortOrder = cleanSortOrder(body?.sortOrder);

  if (name.length < 2 || name.length > 120) return { error: "Bitte gib einen gültigen Namen ein." };
  if (role.length < 1 || role.length > 160) return { error: "Bitte wähle eine gültige Position aus." };
  if (expertise.length > 240) return { error: "Die Expertise darf maximal 240 Zeichen enthalten." };
  if (description.length > 1200) return { error: "Die Beschreibung darf maximal 1200 Zeichen enthalten." };
  if (sortOrder === null) return { error: "Die Reihenfolge muss eine Zahl zwischen 0 und 10000 sein." };

  return { member: { name, role, expertise, description, sortOrder } };
}

async function handleTeam(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const rows = await db.select().from(teamMembers).orderBy(asc(teamMembers.sortOrder), asc(teamMembers.id));
    return res.status(200).json({ teamMembers: rows });
  }

  if (req.method === "POST") {
    const user = await requirePermission(req, res, "team", "edit");
    if (!user) return;

    const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as Record<string, unknown> | null;
    const validated = validateMember(body);
    if ("error" in validated) {
      return res.status(422).json({ error: validated.error });
    }

    const [created] = await db.insert(teamMembers).values(validated.member).returning();
    return res.status(201).json({ teamMember: created });
  }

  if (req.method === "PATCH") {
    const user = await requirePermission(req, res, "team", "edit");
    if (!user) return;

    const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as Record<string, unknown> | null;
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Ungültiges Teammitglied." });
    }

    const validated = validateMember(body);
    if ("error" in validated) {
      return res.status(422).json({ error: validated.error });
    }

    const [updated] = await db
      .update(teamMembers)
      .set({ ...validated.member, updatedAt: new Date() })
      .where(eq(teamMembers.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Teammitglied nicht gefunden." });
    }

    return res.status(200).json({ teamMember: updated });
  }

  if (req.method === "DELETE") {
    const user = await requirePermission(req, res, "team", "edit");
    if (!user) return;

    const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as { id?: number } | null;
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Ungültiges Teammitglied." });
    }

    const [deleted] = await db.delete(teamMembers).where(eq(teamMembers.id, id)).returning({ id: teamMembers.id });
    if (!deleted) {
      return res.status(404).json({ error: "Teammitglied nicht gefunden." });
    }

    return res.status(200).json({ deleted: true, id: deleted.id });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).end("Method not allowed");
}

// --- Nutzer / Login-Zugänge (intern) ---

function cleanUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanPermissions(value: unknown): PermissionMap {
  const result: PermissionMap = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  const input = value as Record<string, unknown>;
  for (const category of CATEGORIES) {
    const level = input[category];
    if (level === "view" || level === "edit") result[category] = level;
  }
  return result;
}

async function handleUsers(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const currentUser = await requirePermission(req, res, "users", "view");
    if (!currentUser) return;

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) return res.status(500).json({ error: "Nutzer konnten nicht geladen werden." });

    const users = data.users
      .map((user) => ({
        id: user.id,
        username: emailToUsername(user.email || "", user.app_metadata as any),
        permissions: getPermissions(user as any),
        createdAt: user.created_at,
        isSelf: user.id === currentUser.id,
      }))
      .sort((a, b) => a.username.localeCompare(b.username));

    return res.status(200).json({ users });
  }

  const currentUser = await requirePermission(req, res, "users", "edit");
  if (!currentUser) return;

  const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as Record<string, unknown> | null;

  if (req.method === "POST") {
    const username = cleanUsername(body?.username);
    const password = typeof body?.password === "string" ? body.password : "";
    const permissions = cleanPermissions(body?.permissions);

    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
      return res.status(422).json({ error: "Benutzername muss 3-32 Zeichen lang sein (nur Buchstaben, Zahlen, . _ -)." });
    }
    if (password.length < 8) {
      return res.status(422).json({ error: "Passwort muss mindestens 8 Zeichen lang sein." });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: usernameToEmail(username),
      password,
      email_confirm: true,
      app_metadata: { role: "admin", username, permissions },
    });

    if (error) {
      const message = /already.*registered|already exists/i.test(error.message || "")
        ? "Dieser Benutzername ist bereits vergeben."
        : "Nutzer konnte nicht angelegt werden.";
      return res.status(422).json({ error: message });
    }

    return res.status(201).json({
      user: {
        id: data.user!.id,
        username,
        permissions,
        createdAt: data.user!.created_at,
        isSelf: false,
      },
    });
  }

  if (req.method === "PATCH") {
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return res.status(400).json({ error: "Ungültiger Nutzer." });

    const { data: existing, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(id);
    if (fetchError || !existing?.user) {
      return res.status(404).json({ error: "Nutzer nicht gefunden." });
    }

    const existingUsername = emailToUsername(existing.user.email || "", existing.user.app_metadata as any);
    const updates: Record<string, unknown> = {};

    if (body && "permissions" in body) {
      const permissions = cleanPermissions(body.permissions);
      updates.app_metadata = { role: "admin", username: existingUsername, permissions };
    }

    if (body && typeof body.password === "string" && body.password) {
      if (body.password.length < 8) {
        return res.status(422).json({ error: "Passwort muss mindestens 8 Zeichen lang sein." });
      }
      updates.password = body.password;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Keine Änderungen übergeben." });
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, updates as any);
    if (error) return res.status(422).json({ error: "Nutzer konnte nicht aktualisiert werden." });

    return res.status(200).json({
      user: {
        id: data.user!.id,
        username: emailToUsername(data.user!.email || "", data.user!.app_metadata as any),
        permissions: getPermissions(data.user as any),
        isSelf: data.user!.id === currentUser.id,
      },
    });
  }

  if (req.method === "DELETE") {
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return res.status(400).json({ error: "Ungültiger Nutzer." });
    if (id === currentUser.id) {
      return res.status(400).json({ error: "Du kannst dich nicht selbst löschen." });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) return res.status(422).json({ error: "Nutzer konnte nicht gelöscht werden." });

    return res.status(200).json({ deleted: true, id });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).end("Method not allowed");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  // Team-Profile und Nutzer-Zugänge teilen sich eine Funktion, damit wir
  // unter dem Function-Limit von Vercel (Hobby-Plan: max. 12) bleiben.
  const resource = typeof req.query.resource === "string" ? req.query.resource : "team";

  if (resource === "users") return handleUsers(req, res);
  return handleTeam(req, res);
}
