import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { vipTicketTypes, vipTickets } from "../db/schema.js";
import { requirePermission } from "./_lib/auth.js";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanInteger(value: unknown, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

// --- Ticket-Arten ---

function validateType(body: Record<string, unknown> | null) {
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

async function handleTypes(req: VercelRequest, res: VercelResponse) {
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
    const validated = validateType(body);
    if ("error" in validated) return res.status(422).json({ error: validated.error });

    const [created] = await db.insert(vipTicketTypes).values(validated.item).returning();
    return res.status(201).json({ ticketType: created });
  }

  if (req.method === "PATCH") {
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Ungültige Ticket-Art." });

    const validated = validateType(body);
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

// --- Ticket-Inhaber ---

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function addDays(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(fromISO: string, toISO: string) {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

async function withComputedTickets(rows: (typeof vipTickets.$inferSelect)[]) {
  const types = await db.select().from(vipTicketTypes);
  const typeById = new Map(types.map((type) => [type.id, type]));
  const today = new Date().toISOString().slice(0, 10);

  return rows.map((row) => {
    const type = typeById.get(row.ticketTypeId);
    const durationDays = type?.durationDays ?? 0;
    const validUntil = addDays(row.issuedAt, durationDays);
    const daysRemaining = daysBetween(today, validUntil);
    return {
      ...row,
      ticketTypeName: type?.name || "Unbekannt",
      validUntil,
      daysRemaining,
      active: daysRemaining >= 0,
    };
  });
}

function validateTicket(body: Record<string, unknown> | null) {
  const holderName = clean(body?.holderName);
  const ticketTypeId = Number(body?.ticketTypeId);
  const issuedAt = clean(body?.issuedAt);
  const notes = clean(body?.notes);

  if (holderName.length < 1 || holderName.length > 160) return { error: "Bitte gib einen gültigen Namen ein." };
  if (!Number.isInteger(ticketTypeId) || ticketTypeId < 1) return { error: "Bitte wähle eine gültige Ticket-Art aus." };
  if (!isValidDate(issuedAt)) return { error: "Bitte gib ein gültiges Ausstellungsdatum ein." };
  if (notes.length > 1000) return { error: "Die Notiz darf höchstens 1000 Zeichen lang sein." };

  return { item: { holderName, ticketTypeId, issuedAt, notes } };
}

async function handleTickets(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const user = await requirePermission(req, res, "vip", "view");
    if (!user) return;

    const rows = await db.select().from(vipTickets).orderBy(desc(vipTickets.issuedAt), desc(vipTickets.id));
    return res.status(200).json({ tickets: await withComputedTickets(rows) });
  }

  const user = await requirePermission(req, res, "vip", "edit");
  if (!user) return;

  const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as Record<string, unknown> | null;

  if (req.method === "POST") {
    const validated = validateTicket(body);
    if ("error" in validated) return res.status(422).json({ error: validated.error });

    const [created] = await db.insert(vipTickets).values(validated.item).returning();
    const [withComputedFields] = await withComputedTickets([created]);
    return res.status(201).json({ ticket: withComputedFields });
  }

  if (req.method === "PATCH") {
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Ungültiges Ticket." });

    const validated = validateTicket(body);
    if ("error" in validated) return res.status(422).json({ error: validated.error });

    const [updated] = await db.update(vipTickets).set(validated.item).where(eq(vipTickets.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Ticket nicht gefunden." });

    const [withComputedFields] = await withComputedTickets([updated]);
    return res.status(200).json({ ticket: withComputedFields });
  }

  if (req.method === "DELETE") {
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Ungültiges Ticket." });

    const [deleted] = await db.delete(vipTickets).where(eq(vipTickets.id, id)).returning({ id: vipTickets.id });
    if (!deleted) return res.status(404).json({ error: "Ticket nicht gefunden." });
    return res.status(200).json({ deleted: true, id: deleted.id });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).end("Method not allowed");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  // Ticket-Arten und Ticket-Inhaber teilen sich eine Funktion, damit wir
  // unter dem Function-Limit von Vercel (Hobby-Plan: max. 12) bleiben.
  const resource = typeof req.query.resource === "string" ? req.query.resource : "tickets";

  if (resource === "types") return handleTypes(req, res);
  return handleTickets(req, res);
}
