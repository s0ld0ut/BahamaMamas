import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  CATEGORIES,
  emailToUsername,
  getPermissions,
  requirePermission,
  supabaseAdmin,
  usernameToEmail,
  type PermissionMap,
} from "./_lib/auth.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

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
