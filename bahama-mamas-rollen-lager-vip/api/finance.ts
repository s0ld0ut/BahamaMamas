import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { financeEntries } from "../db/schema.js";
import { requirePermission } from "./_lib/auth.js";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validate(body: Record<string, unknown> | null) {
  const entryDate = clean(body?.entryDate);
  const description = clean(body?.description);
  const amount = Number(body?.amount);

  if (!isValidDate(entryDate)) return { error: "Bitte gib ein gültiges Datum ein." };
  if (description.length < 1 || description.length > 240) return { error: "Bitte gib eine gültige Beschreibung ein (max. 240 Zeichen)." };
  if (!Number.isInteger(amount) || Math.abs(amount) > 1000000000) return { error: "Der Betrag muss eine ganze Zahl sein (negativ für Ausgaben)." };

  return { item: { entryDate, description, amount } };
}

async function withRunningBalance() {
  const rows = await db.select().from(financeEntries).orderBy(asc(financeEntries.entryDate), asc(financeEntries.id));
  let balance = 0;
  const withBalance = rows.map((row) => {
    balance += row.amount;
    return { ...row, balanceAfter: balance };
  });
  return { entries: withBalance.reverse(), balance };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const user = await requirePermission(req, res, "finance", "view");
    if (!user) return;

    const { entries, balance } = await withRunningBalance();
    return res.status(200).json({ entries, balance });
  }

  const user = await requirePermission(req, res, "finance", "edit");
  if (!user) return;

  const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as Record<string, unknown> | null;

  if (req.method === "POST") {
    const validated = validate(body);
    if ("error" in validated) return res.status(422).json({ error: validated.error });

    await db.insert(financeEntries).values(validated.item);
    const { entries, balance } = await withRunningBalance();
    return res.status(201).json({ entries, balance });
  }

  if (req.method === "PATCH") {
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Ungültiger Eintrag." });

    const validated = validate(body);
    if ("error" in validated) return res.status(422).json({ error: validated.error });

    const [updated] = await db.update(financeEntries).set(validated.item).where(eq(financeEntries.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Eintrag nicht gefunden." });

    const { entries, balance } = await withRunningBalance();
    return res.status(200).json({ entries, balance });
  }

  if (req.method === "DELETE") {
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Ungültiger Eintrag." });

    const [deleted] = await db.delete(financeEntries).where(eq(financeEntries.id, id)).returning({ id: financeEntries.id });
    if (!deleted) return res.status(404).json({ error: "Eintrag nicht gefunden." });

    const { entries, balance } = await withRunningBalance();
    return res.status(200).json({ deleted: true, id: deleted.id, entries, balance });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).end("Method not allowed");
}
