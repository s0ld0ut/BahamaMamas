import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { ingredients } from "../db/schema.js";
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
  const stockTarget = cleanInteger(body?.stockTarget, 0, 1000000);
  const costPrice = cleanInteger(body?.costPrice, 0, 10000000);
  const stockCurrent = cleanInteger(body?.stockCurrent, 0, 1000000);

  if (name.length < 1 || name.length > 120) return { error: "Bitte gib einen gültigen Namen ein." };
  if (stockTarget === null) return { error: "Der Soll-Bestand muss eine ganze Zahl zwischen 0 und 1.000.000 sein." };
  if (costPrice === null) return { error: "Der Einkaufspreis muss eine ganze Zahl zwischen 0 und 10.000.000 sein." };
  if (stockCurrent === null) return { error: "Der Ist-Bestand muss eine ganze Zahl zwischen 0 und 1.000.000 sein." };

  return { item: { name, stockTarget, costPrice, stockCurrent } };
}

function withComputed(row: typeof ingredients.$inferSelect) {
  const missing = Math.max(0, row.stockTarget - row.stockCurrent);
  return { ...row, missing, restockCost: missing * row.costPrice };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const user = await requirePermission(req, res, "menu", "view");
    if (!user) return;

    const rows = await db.select().from(ingredients).orderBy(asc(ingredients.name));
    return res.status(200).json({ ingredients: rows.map(withComputed) });
  }

  const user = await requirePermission(req, res, "menu", "edit");
  if (!user) return;

  const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as Record<string, unknown> | null;

  if (req.method === "POST") {
    const validated = validate(body);
    if ("error" in validated) return res.status(422).json({ error: validated.error });

    const [created] = await db.insert(ingredients).values(validated.item).returning();
    return res.status(201).json({ ingredient: withComputed(created) });
  }

  if (req.method === "PATCH") {
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Ungültige Zutat." });

    const validated = validate(body);
    if ("error" in validated) return res.status(422).json({ error: validated.error });

    const [updated] = await db
      .update(ingredients)
      .set({ ...validated.item, updatedAt: new Date() })
      .where(eq(ingredients.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Zutat nicht gefunden." });
    return res.status(200).json({ ingredient: withComputed(updated) });
  }

  if (req.method === "DELETE") {
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Ungültige Zutat." });

    const [deleted] = await db.delete(ingredients).where(eq(ingredients.id, id)).returning({ id: ingredients.id });
    if (!deleted) return res.status(404).json({ error: "Zutat nicht gefunden." });
    return res.status(200).json({ deleted: true, id: deleted.id });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).end("Method not allowed");
}
