import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { recipeItems } from "../db/schema.js";
import { requirePermission } from "./_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const user = await requirePermission(req, res, "menu", "edit");
  if (!user) return;

  const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as Record<string, unknown> | null;

  if (req.method === "POST") {
    const menuItemId = Number(body?.menuItemId);
    const ingredientId = Number(body?.ingredientId);
    const amount = Number(body?.amount);

    if (!Number.isInteger(menuItemId) || menuItemId < 1) return res.status(400).json({ error: "Ungültiger Speisekarten-Eintrag." });
    if (!Number.isInteger(ingredientId) || ingredientId < 1) return res.status(400).json({ error: "Ungültige Zutat." });
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) return res.status(422).json({ error: "Die Menge muss eine ganze Zahl zwischen 1 und 100.000 sein." });

    const [created] = await db.insert(recipeItems).values({ menuItemId, ingredientId, amount }).returning();
    return res.status(201).json({ recipeItem: created });
  }

  if (req.method === "DELETE") {
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Ungültiger Rezept-Eintrag." });

    const [deleted] = await db.delete(recipeItems).where(eq(recipeItems.id, id)).returning({ id: recipeItems.id });
    if (!deleted) return res.status(404).json({ error: "Rezept-Eintrag nicht gefunden." });
    return res.status(200).json({ deleted: true, id: deleted.id });
  }

  res.setHeader("Allow", "POST, DELETE");
  return res.status(405).end("Method not allowed");
}
