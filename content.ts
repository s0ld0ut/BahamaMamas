import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { infoNotes } from "../db/schema.js";
import { requirePermission } from "./_lib/auth.js";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanInteger(value: unknown, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function validate(body: Record<string, unknown> | null) {
  const title = clean(body?.title);
  const bodyText = clean(body?.body);
  const sortOrder = cleanInteger(body?.sortOrder, 0, 10000);
  const pinned = body?.pinned === true || body?.pinned === "true";

  if (title.length < 1 || title.length > 160) return { error: "Bitte gib einen gültigen Titel ein." };
  if (bodyText.length > 5000) return { error: "Der Text darf höchstens 5000 Zeichen lang sein." };
  if (sortOrder === null) return { error: "Die Reihenfolge muss eine Zahl zwischen 0 und 10000 sein." };

  return { item: { title, body: bodyText, sortOrder, pinned } };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const user = await requirePermission(req, res, "info", "view");
    if (!user) return;

    const rows = await db.select().from(infoNotes).orderBy(desc(infoNotes.pinned), asc(infoNotes.sortOrder), asc(infoNotes.id));
    return res.status(200).json({ notes: rows });
  }

  const user = await requirePermission(req, res, "info", "edit");
  if (!user) return;

  const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as Record<string, unknown> | null;

  if (req.method === "POST") {
    const validated = validate(body);
    if ("error" in validated) return res.status(422).json({ error: validated.error });

    const [created] = await db.insert(infoNotes).values(validated.item).returning();
    return res.status(201).json({ note: created });
  }

  if (req.method === "PATCH") {
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Ungültiger Hinweis." });

    const validated = validate(body);
    if ("error" in validated) return res.status(422).json({ error: validated.error });

    const [updated] = await db
      .update(infoNotes)
      .set({ ...validated.item, updatedAt: new Date() })
      .where(eq(infoNotes.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Hinweis nicht gefunden." });
    return res.status(200).json({ note: updated });
  }

  if (req.method === "DELETE") {
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Ungültiger Hinweis." });

    const [deleted] = await db.delete(infoNotes).where(eq(infoNotes.id, id)).returning({ id: infoNotes.id });
    if (!deleted) return res.status(404).json({ error: "Hinweis nicht gefunden." });
    return res.status(200).json({ deleted: true, id: deleted.id });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).end("Method not allowed");
}
