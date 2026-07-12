import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { applications } from "../db/schema.js";
import { requirePermission } from "./_lib/auth.js";

type ApplicationPayload = {
  fullName?: string;
  age?: string;
  phone?: string;
  position?: string;
  motivation?: string;
  experience?: string;
  guestExperience?: string;
  availability?: string;
  contactPreference?: string;
  customAnswers?: Record<string, unknown>;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "POST") {
    const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as ApplicationPayload | null;

    if (!body) {
      return res.status(400).json({ error: "Ungültige Bewerbung." });
    }

    const fullName = clean(body.fullName);
    const age = clean(body.age);
    const phone = clean(body.phone);
    const position = clean(body.position);
    const motivation = clean(body.motivation);
    const experience = clean(body.experience);
    const guestExperience = clean(body.guestExperience);
    const availability = clean(body.availability);
    const contactPreference = clean(body.contactPreference);
    const customAnswers = body.customAnswers && typeof body.customAnswers === "object" && !Array.isArray(body.customAnswers)
      ? Object.fromEntries(Object.entries(body.customAnswers).map(([key, value]) => [clean(key), clean(value)]).filter(([key, value]) => key && value.length <= 5000))
      : {};

    const requiredValues = [
      fullName,
      age,
      phone,
      position,
      motivation,
      experience,
      guestExperience,
      availability,
      contactPreference,
    ];

    if (requiredValues.some((value) => value.length < 2)) {
      return res.status(422).json({ error: "Bitte fülle alle Felder aus." });
    }

    if (position.length > 160 || JSON.stringify(customAnswers).length > 30000) {
      return res.status(422).json({ error: "Die zusätzlichen Angaben sind zu lang." });
    }

    const [created] = await db
      .insert(applications)
      .values({
        fullName,
        age,
        phone,
        position,
        motivation,
        experience,
        guestExperience,
        availability,
        contactPreference,
        customAnswers: JSON.stringify(customAnswers),
      })
      .returning({
        id: applications.id,
        createdAt: applications.createdAt,
      });

    return res.status(201).json({ application: created });
  }

  if (req.method === "GET") {
    const user = await requirePermission(req, res, "applications", "view");
    if (!user) return;

    const rows = await db.select().from(applications).orderBy(desc(applications.createdAt));
    return res.status(200).json({ applications: rows });
  }

  if (req.method === "PATCH") {
    const user = await requirePermission(req, res, "applications", "edit");
    if (!user) return;

    const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as {
      id?: number;
      status?: string;
      adminNotes?: string;
      applicationFolder?: string;
    } | null;
    const id = Number(body?.id);
    const status = clean(body?.status);
    const adminNotes = clean(body?.adminNotes);
    const applicationFolder = clean(body?.applicationFolder);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Ungültige Bewerbung." });
    }

    const allowedStatuses = new Set(["neu", "kontaktiert", "angenommen", "abgelehnt"]);
    if (!allowedStatuses.has(status)) {
      return res.status(422).json({ error: "Ungültiger Status." });
    }

    const allowedFolders = new Set(["neu", "gespeichert"]);
    if (applicationFolder && !allowedFolders.has(applicationFolder)) {
      return res.status(422).json({ error: "Ungültiger Ordner." });
    }

    const [updated] = await db
      .update(applications)
      .set({
        status,
        adminNotes,
        ...(applicationFolder ? { applicationFolder } : {}),
      })
      .where(eq(applications.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Bewerbung nicht gefunden." });
    }

    return res.status(200).json({ application: updated });
  }

  if (req.method === "DELETE") {
    const user = await requirePermission(req, res, "applications", "edit");
    if (!user) return;

    const body = (typeof req.body === "object" && req.body !== null ? req.body : null) as { id?: number } | null;
    const id = Number(body?.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Ungültige Bewerbung." });
    }

    const [deleted] = await db.delete(applications).where(eq(applications.id, id)).returning({
      id: applications.id,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Bewerbung nicht gefunden." });
    }

    return res.status(200).json({ deleted: true, id: deleted.id });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).end("Method not allowed");
}
