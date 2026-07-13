-- Einmalig im Supabase SQL Editor ausführen. Idempotent (mehrfach ausführbar).

-- Neue Spalten an der Speisekarte für Lagerhaltung & Kalkulation
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "cost_price" integer NOT NULL DEFAULT 0;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "stock_target" integer NOT NULL DEFAULT 0;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "stock_current" integer NOT NULL DEFAULT 0;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "recipe_visible" boolean NOT NULL DEFAULT false;

-- Rohstoff-Lager (Zutaten)
CREATE TABLE IF NOT EXISTS "ingredients" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "stock_target" integer NOT NULL DEFAULT 0,
  "cost_price" integer NOT NULL DEFAULT 0,
  "stock_current" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Rezepte: welche Zutaten in welcher Menge in welchem Speisekarten-Eintrag stecken
CREATE TABLE IF NOT EXISTS "recipe_items" (
  "id" serial PRIMARY KEY,
  "menu_item_id" integer NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE,
  "ingredient_id" integer NOT NULL REFERENCES "ingredients"("id") ON DELETE CASCADE,
  "amount" integer NOT NULL DEFAULT 1
);

-- VIP-Ticket-Arten (Bronze/Silber/Gold, frei erweiterbar)
CREATE TABLE IF NOT EXISTS "vip_ticket_types" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "duration_days" integer NOT NULL DEFAULT 30,
  "price" integer NOT NULL DEFAULT 0,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- VIP-Ticket-Inhaber (wer hat wann ein Ticket bekommen)
CREATE TABLE IF NOT EXISTS "vip_tickets" (
  "id" serial PRIMARY KEY,
  "holder_name" text NOT NULL,
  "ticket_type_id" integer NOT NULL REFERENCES "vip_ticket_types"("id") ON DELETE RESTRICT,
  "issued_at" text NOT NULL,
  "notes" text NOT NULL DEFAULT '',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Finanzen: Ein-/Ausgaben-Liste, laufender Saldo wird im Code berechnet
CREATE TABLE IF NOT EXISTS "finance_entries" (
  "id" serial PRIMARY KEY,
  "entry_date" text NOT NULL,
  "description" text NOT NULL,
  "amount" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Wichtige Infos / interne Hinweise für Mitarbeiter
CREATE TABLE IF NOT EXISTS "info_notes" (
  "id" serial PRIMARY KEY,
  "title" text NOT NULL,
  "body" text NOT NULL DEFAULT '',
  "pinned" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Beispiel-VIP-Ticket-Arten nur einfügen, falls die Tabelle noch leer ist
INSERT INTO "vip_ticket_types" ("name", "duration_days", "price", "sort_order")
SELECT * FROM (VALUES
  ('BRONZE | 1 Monat', 30, 50000, 10),
  ('SILBER | 2 Monate', 60, 90000, 20),
  ('GOLD | 3 Monate', 90, 125000, 30)
) AS seed(name, duration_days, price, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM "vip_ticket_types");
