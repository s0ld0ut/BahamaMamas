import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { vipTicketTypes } from "../db/schema.js";
import { requirePermission } from "./_lib/auth.js";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanInteger(value: unknown, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function validate(body: Record<string, unknown> | null) {
  const name = clean(body?.name);
  const durationDays = cleanInteger(body?.durationDays, 1, 3650);
  const price = cleanInteger(body?.price, 0, 100000000);
  const sortOrder = cleanInteger(body?.sortOrder, 0, 10000);

  if (name.length < 1 || name.length > 120) return { error: "Bitte gib einen gültigen Namen ein." };
  if (durationDays === null) return { error: "Die Laufzeit muss zwischen 1 und 3650 Tagen liegen." };
  if (price === null) return { error: "Der Preis muss eine ganze Zahl zwischen 0 und 100.000.000 sein." };
  if (sortOrder === null) return { error: "Die Reihenfolge muss eine Zahl zwischen 0 und 10000 sein." };

  return { item: { name, durationDays, price, sortOrder } };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const user = await requirePermission(req, res, "vip", "view");
    if (!user) return;

    const rows = await db.select().from(vipTicketTypes).orderBy(asc(vipTicketTypes.sortOrder), asc(vipTicketTypes.id));
    return res.status(200).json({ ticketTypes: rows });
  }

  const user = await requirePermission(req, res, "vip", "edit");
  if (!user) return;

  const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as Record<string, unknown> | null;

  if (req.method === "POST") {
    const validated = validate(body);
    if ("error" in validated) return res.status(422).json({ error: validated.error });

    const [created] = await db.insert(vipTicketTypes).values(validated.item).returning();
    return res.status(201).json({ ticketType: created });
  }

  if (req.method === "PATCH") {
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Ungültige Ticket-Art." });

    const validated = validate(body);
    if ("error" in validated) return res.status(422).json({ error: validated.error });

    const [updated] = await db
      .update(vipTicketTypes)
      .set({ ...validated.item, updatedAt: new Date() })
      .where(eq(vipTicketTypes.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Ticket-Art nicht gefunden." });
    return res.status(200).json({ ticketType: updated });
  }

  if (req.method === "DELETE") {
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Ungültige Ticket-Art." });

    const [deleted] = await db.delete(vipTicketTypes).where(eq(vipTicketTypes.id, id)).returning({ id: vipTicketTypes.id });
    if (!deleted) return res.status(404).json({ error: "Ticket-Art nicht gefunden." });
    return res.status(200).json({ deleted: true, id: deleted.id });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).end("Method not allowed");
}
