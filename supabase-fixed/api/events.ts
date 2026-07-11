import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { events } from "../db/schema.js";
import { requireAdmin } from "./_lib/auth.js";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateEvent(body: Record<string, unknown> | null) {
  const eventDate = clean(body?.eventDate);
  const startTime = clean(body?.startTime);
  const name = clean(body?.name);
  const description = clean(body?.description);
  const status = clean(body?.status);

  if (!isValidDate(eventDate)) return { error: "Bitte wähle ein gültiges Datum aus." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) return { error: "Bitte wähle eine gültige Startzeit aus." };
  if (name.length < 2 || name.length > 140) return { error: "Der Event-Name muss zwischen 2 und 140 Zeichen lang sein." };
  if (description.length > 1200) return { error: "Die Beschreibung darf höchstens 1200 Zeichen lang sein." };
  if (status.length < 1 || status.length > 120) return { error: "Bitte wähle einen gültigen Status aus." };

  return { item: { eventDate, startTime, name, description, status } };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const rows = await db.select().from(events).orderBy(asc(events.eventDate), asc(events.startTime), asc(events.id));
    return res.status(200).json({ events: rows });
  }

  if (req.method === "POST") {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as Record<string, unknown> | null;
    const validated = validateEvent(body);
    if ("error" in validated) {
      return res.status(422).json({ error: validated.error });
    }

    const [created] = await db.insert(events).values(validated.item).returning();
    return res.status(201).json({ event: created });
  }

  if (req.method === "PATCH") {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as Record<string, unknown> | null;
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Ungültiges Event." });
    }

    const validated = validateEvent(body);
    if ("error" in validated) {
      return res.status(422).json({ error: validated.error });
    }

    const [updated] = await db
      .update(events)
      .set({ ...validated.item, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Event nicht gefunden." });
    }

    return res.status(200).json({ event: updated });
  }

  if (req.method === "DELETE") {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as { id?: number } | null;
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Ungültiges Event." });
    }

    const [deleted] = await db.delete(events).where(eq(events.id, id)).returning({ id: events.id });
    if (!deleted) {
      return res.status(404).json({ error: "Event nicht gefunden." });
    }

    return res.status(200).json({ deleted: true, id: deleted.id });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).end("Method not allowed");
}
