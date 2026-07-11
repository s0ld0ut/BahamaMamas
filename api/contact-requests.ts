import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { contactRequests } from "../db/schema.js";
import { requireAdmin } from "./_lib/auth.js";

const folders = new Set(["neu", "archiv"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "POST") {
    const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as {
      nameOrCompany?: string;
      contactMethod?: string;
      requestType?: string;
      subject?: string;
      message?: string;
    } | null;

    if (!body) {
      return res.status(400).json({ error: "Ungültige Kontaktanfrage." });
    }

    const nameOrCompany = clean(body.nameOrCompany);
    const contactMethod = clean(body.contactMethod);
    const requestType = clean(body.requestType);
    const subject = clean(body.subject);
    const message = clean(body.message);

    if (nameOrCompany.length < 2 || contactMethod.length < 3 || subject.length < 2 || message.length < 5) {
      return res.status(422).json({ error: "Bitte fülle alle Felder vollständig aus." });
    }

    if (requestType.length < 1 || requestType.length > 160) {
      return res.status(422).json({ error: "Bitte wähle eine gültige Art der Anfrage." });
    }

    const [created] = await db
      .insert(contactRequests)
      .values({ nameOrCompany, contactMethod, requestType, subject, message })
      .returning({ id: contactRequests.id, createdAt: contactRequests.createdAt });

    return res.status(201).json({ contactRequest: created });
  }

  if (req.method === "GET") {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const rows = await db.select().from(contactRequests).orderBy(desc(contactRequests.createdAt));
    return res.status(200).json({ contactRequests: rows });
  }

  if (req.method === "PATCH") {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as { id?: number; folder?: string } | null;
    const id = Number(body?.id);
    const folder = clean(body?.folder);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Ungültige Kontaktanfrage." });
    }

    if (!folders.has(folder)) {
      return res.status(422).json({ error: "Ungültiger Ordner." });
    }

    const [updated] = await db
      .update(contactRequests)
      .set({ folder })
      .where(eq(contactRequests.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Kontaktanfrage nicht gefunden." });
    }

    return res.status(200).json({ contactRequest: updated });
  }

  if (req.method === "DELETE") {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as { id?: number } | null;
    const id = Number(body?.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Ungültige Kontaktanfrage." });
    }

    const [deleted] = await db.delete(contactRequests).where(eq(contactRequests.id, id)).returning({
      id: contactRequests.id,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Kontaktanfrage nicht gefunden." });
    }

    return res.status(200).json({ deleted: true, id: deleted.id });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).end("Method not allowed");
}
