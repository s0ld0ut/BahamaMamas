import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { contentBlocks, siteSettings } from "../db/schema.js";
import { requireAdmin } from "./_lib/auth.js";

const defaultSettings = {
  homeTitle: "Willkommen im Neon Paradise",
  homeText: "Das Bahama Mamas ist das Juwel von Rockford Hills. Wir bieten eine Flucht aus der Realität durch erstklassigen Service, exklusive Drinks und unvergessliche Nächte.",
  applicationTitle: "Werde Teil der Crew",
  applicationIntro: "Bahama Mamas. Rockford Hills' #1 Nightlife Destination. Erstklassige Drinks, elektrisierende Beats, exklusive Stimmung. Sei dabei.",
  contactTitle: "Kontakt",
  contactIntro: "Willkommen im Neon Paradise. Wir freuen uns über dein Interesse am Bahama Mamas.",
  applicationPositions: ["Bar Manager (Barkeeper)", "Service Manager (Service Personal)", "Nightlife Talent (Tänzer/in)", "DJ", "Security Team (Security)", "Rising Star (Quereinsteiger)"],
  contactRequestTypes: ["Sponsoring", "Allgemeine Fragen", "Partnerschaft", "Sonstiges"],
  teamPositions: ["Owner", "Co-Owner", "Event Director", "DJ", "Bar Manager", "Service Manager", "Nightlife Talent", "Security Team", "Rising Star"],
  menuCategories: [
    { value: "signature-drinks", label: "SIGNATURE DRINKS" },
    { value: "spirits", label: "SPIRITS" },
    { value: "fresh-virgin", label: "FRESH & VIRGIN" },
    { value: "bar-bites", label: "BAR BITES" },
    { value: "extras", label: "EXTRA'S" },
  ],
  eventStatuses: [{ value: "soon", label: "Soon" }, { value: "aktiv", label: "Aktiv" }, { value: "beendet", label: "Beendet" }, { value: "in-planung", label: "In Planung" }],
  applicationFields: [],
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseValue(value: string) {
  try { return JSON.parse(value); } catch { return value; }
}

function validateSettings(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const settings = value as Record<string, unknown>;
  const serialized = JSON.stringify(settings);
  return serialized.length <= 50000 ? settings : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const [settingRows, blocks] = await Promise.all([
      db.select().from(siteSettings),
      db.select().from(contentBlocks).orderBy(asc(contentBlocks.sortOrder), asc(contentBlocks.id)),
    ]);
    const storedSettings = Object.fromEntries(settingRows.map((row) => [row.key, parseValue(row.value)]));
    return res.status(200).json({ settings: { ...defaultSettings, ...storedSettings }, blocks });
  }

  const user = await requireAdmin(req, res);
  if (!user) return;

  const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as Record<string, unknown> | null;

  if (req.method === "PUT") {
    const settings = validateSettings(body?.settings);
    if (!settings) return res.status(422).json({ error: "Ungültige Einstellungen." });
    await Promise.all(Object.entries(settings).map(([key, value]) => db.insert(siteSettings).values({ key, value: JSON.stringify(value) }).onConflictDoUpdate({ target: siteSettings.key, set: { value: JSON.stringify(value), updatedAt: new Date() } })));
    return res.status(200).json({ saved: true });
  }

  if (req.method === "POST") {
    const title = clean(body?.title);
    const blockBody = clean(body?.body);
    const section = clean(body?.section) || "home";
    const sortOrder = Number(body?.sortOrder);
    if (title.length < 1 || title.length > 160 || blockBody.length > 5000 || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
      return res.status(422).json({ error: "Bitte prüfe Titel, Text und Reihenfolge." });
    }
    const [block] = await db.insert(contentBlocks).values({ title, body: blockBody, section, sortOrder }).returning();
    return res.status(201).json({ block });
  }

  if (req.method === "PATCH") {
    const id = Number(body?.id);
    const title = clean(body?.title);
    const blockBody = clean(body?.body);
    const section = clean(body?.section) || "home";
    const sortOrder = Number(body?.sortOrder);
    if (!Number.isInteger(id) || id < 1 || title.length < 1 || title.length > 160 || blockBody.length > 5000 || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
      return res.status(422).json({ error: "Bitte prüfe den Inhaltsblock." });
    }
    const [block] = await db.update(contentBlocks).set({ title, body: blockBody, section, sortOrder, updatedAt: new Date() }).where(eq(contentBlocks.id, id)).returning();
    if (!block) return res.status(404).json({ error: "Inhaltsblock nicht gefunden." });
    return res.status(200).json({ block });
  }

  if (req.method === "DELETE") {
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Ungültiger Inhaltsblock." });
    const [deleted] = await db.delete(contentBlocks).where(eq(contentBlocks.id, id)).returning({ id: contentBlocks.id });
    if (!deleted) return res.status(404).json({ error: "Inhaltsblock nicht gefunden." });
    return res.status(200).json({ deleted: true });
  }

  res.setHeader("Allow", "GET, PUT, POST, PATCH, DELETE");
  return res.status(405).end("Method not allowed");
}
