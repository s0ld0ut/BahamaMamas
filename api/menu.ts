import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { ingredients, menuItems, recipeItems } from "../db/schema.js";
import { getPermissionsFromRequest, hasLevel, requirePermission } from "./_lib/auth.js";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanInteger(value: unknown, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function validateMenuItem(body: Record<string, unknown> | null) {
  const name = clean(body?.name);
  const description = clean(body?.description);
  const category = clean(body?.category);
  const price = cleanInteger(body?.price, 0, 10000000);
  const sortOrder = cleanInteger(body?.sortOrder, 0, 10000);
  const costPrice = cleanInteger(body?.costPrice, 0, 10000000);
  const stockTarget = cleanInteger(body?.stockTarget, 0, 1000000);
  const stockCurrent = cleanInteger(body?.stockCurrent, 0, 1000000);
  const recipeVisible = body?.recipeVisible === true || body?.recipeVisible === "true";

  if (name.length < 2 || name.length > 120) return { error: "Bitte gib einen gültigen Namen ein." };
  if (description.length > 500) return { error: "Die Beschreibung darf höchstens 500 Zeichen lang sein." };
  if (category.length < 1 || category.length > 120) return { error: "Bitte wähle eine gültige Kategorie aus." };
  if (price === null) return { error: "Der Preis muss eine ganze Dollarzahl zwischen 0 und 10.000.000 sein." };
  if (sortOrder === null) return { error: "Die Reihenfolge muss eine Zahl zwischen 0 und 10000 sein." };
  if (costPrice === null) return { error: "Der Einkaufspreis muss eine ganze Zahl zwischen 0 und 10.000.000 sein." };
  if (stockTarget === null) return { error: "Der Soll-Bestand muss eine ganze Zahl zwischen 0 und 1.000.000 sein." };
  if (stockCurrent === null) return { error: "Der Ist-Bestand muss eine ganze Zahl zwischen 0 und 1.000.000 sein." };

  return { item: { name, description, category, price, sortOrder, costPrice, stockTarget, stockCurrent, recipeVisible } };
}

async function attachRecipes(rows: (typeof menuItems.$inferSelect)[], onlyVisible: boolean) {
  const relevantIds = rows.filter((row) => !onlyVisible || row.recipeVisible).map((row) => row.id);
  if (relevantIds.length === 0) {
    return rows.map((row) => ({ ...row, recipe: [] as { ingredientId: number; name: string; amount: number }[] }));
  }

  const recipeRows = await db
    .select({
      id: recipeItems.id,
      menuItemId: recipeItems.menuItemId,
      ingredientId: recipeItems.ingredientId,
      amount: recipeItems.amount,
      ingredientName: ingredients.name,
    })
    .from(recipeItems)
    .innerJoin(ingredients, eq(recipeItems.ingredientId, ingredients.id))
    .where(inArray(recipeItems.menuItemId, relevantIds));

  return rows.map((row) => ({
    ...row,
    recipe: (!onlyVisible || row.recipeVisible)
      ? recipeRows
          .filter((entry) => entry.menuItemId === row.id)
          .map((entry) => ({ id: entry.id, ingredientId: entry.ingredientId, name: entry.ingredientName, amount: entry.amount }))
      : [],
  }));
}

// --- Zutaten-Lager (Rohstoffe) ---

function validateIngredient(body: Record<string, unknown> | null) {
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

function withComputedIngredient(row: typeof ingredients.$inferSelect) {
  const missing = Math.max(0, row.stockTarget - row.stockCurrent);
  return { ...row, missing, restockCost: missing * row.costPrice };
}

async function handleIngredients(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const user = await requirePermission(req, res, "menu", "view");
    if (!user) return;

    const rows = await db.select().from(ingredients).orderBy(asc(ingredients.name));
    return res.status(200).json({ ingredients: rows.map(withComputedIngredient) });
  }

  const user = await requirePermission(req, res, "menu", "edit");
  if (!user) return;

  const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as Record<string, unknown> | null;

  if (req.method === "POST") {
    const validated = validateIngredient(body);
    if ("error" in validated) return res.status(422).json({ error: validated.error });

    const [created] = await db.insert(ingredients).values(validated.item).returning();
    return res.status(201).json({ ingredient: withComputedIngredient(created) });
  }

  if (req.method === "PATCH") {
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Ungültige Zutat." });

    const validated = validateIngredient(body);
    if ("error" in validated) return res.status(422).json({ error: validated.error });

    const [updated] = await db
      .update(ingredients)
      .set({ ...validated.item, updatedAt: new Date() })
      .where(eq(ingredients.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Zutat nicht gefunden." });
    return res.status(200).json({ ingredient: withComputedIngredient(updated) });
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

// --- Rezept-Zuordnungen ---

async function handleRecipes(req: VercelRequest, res: VercelResponse) {
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

// --- Speisekarte ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  // Damit wir unter dem Function-Limit von Vercel (Hobby-Plan: max. 12) bleiben,
  // teilen sich Speisekarte, Zutaten-Lager und Rezept-Zuordnungen eine einzige
  // Funktion. Ausgewählt über ?resource=ingredients bzw. ?resource=recipe.
  const resource = typeof req.query.resource === "string" ? req.query.resource : "menu";

  if (resource === "ingredients") return handleIngredients(req, res);
  if (resource === "recipe") return handleRecipes(req, res);

  if (req.method === "GET") {
    const permissions = await getPermissionsFromRequest(req);
    const canManage = hasLevel(permissions.menu, "view");

    const rows = await db.select().from(menuItems).orderBy(asc(menuItems.category), asc(menuItems.sortOrder), asc(menuItems.id));

    if (canManage) {
      const withRecipes = await attachRecipes(rows, false);
      const withMaxWin = withRecipes.map((item) => ({
        ...item,
        maxWin: (item.price - item.costPrice) * item.stockCurrent,
        stockMissing: Math.max(0, item.stockTarget - item.stockCurrent),
      }));
      return res.status(200).json({ menuItems: withMaxWin });
    }

    // Öffentliche Ansicht: keine Lager-/Einkaufsdaten, Rezept nur wenn freigegeben.
    const withRecipes = await attachRecipes(rows, true);
    const publicItems = withRecipes.map(({ id, name, description, category, price, sortOrder, recipeVisible, recipe }) => ({
      id,
      name,
      description,
      category,
      price,
      sortOrder,
      recipeVisible,
      recipe,
    }));
    return res.status(200).json({ menuItems: publicItems });
  }

  if (req.method === "POST") {
    const user = await requirePermission(req, res, "menu", "edit");
    if (!user) return;

    const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as Record<string, unknown> | null;
    const validated = validateMenuItem(body);
    if ("error" in validated) {
      return res.status(422).json({ error: validated.error });
    }

    const [created] = await db.insert(menuItems).values(validated.item).returning();
    return res.status(201).json({ menuItem: created });
  }

  if (req.method === "PATCH") {
    const user = await requirePermission(req, res, "menu", "edit");
    if (!user) return;

    const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as Record<string, unknown> | null;
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Ungültiger Speisekarten-Eintrag." });
    }

    const validated = validateMenuItem(body);
    if ("error" in validated) {
      return res.status(422).json({ error: validated.error });
    }

    const [updated] = await db
      .update(menuItems)
      .set({ ...validated.item, updatedAt: new Date() })
      .where(eq(menuItems.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Speisekarten-Eintrag nicht gefunden." });
    }

    return res.status(200).json({ menuItem: updated });
  }

  if (req.method === "DELETE") {
    const user = await requirePermission(req, res, "menu", "edit");
    if (!user) return;

    const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as { id?: number } | null;
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Ungültiger Speisekarten-Eintrag." });
    }

    const [deleted] = await db.delete(menuItems).where(eq(menuItems.id, id)).returning({ id: menuItems.id });
    if (!deleted) {
      return res.status(404).json({ error: "Speisekarten-Eintrag nicht gefunden." });
    }

    return res.status(200).json({ deleted: true, id: deleted.id });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).end("Method not allowed");
}
