import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { teamMembers } from "../db/schema.js";
import { requireAdmin } from "./_lib/auth.js";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const rows = await db.select().from(teamMembers).orderBy(asc(teamMembers.sortOrder), asc(teamMembers.id));
    return res.status(200).json({ teamMembers: rows });
  }

  if (req.method === "POST") {
    const user = await requireAdmin(req, res);
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
    const user = await requireAdmin(req, res);
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
    const user = await requireAdmin(req, res);
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
