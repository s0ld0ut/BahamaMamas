-- Einmalig im Supabase SQL Editor ausführen (Dashboard -> SQL Editor -> New query).
-- Legt alle Tabellen an, die die Website benötigt. Ist "idempotent", d.h. kann
-- gefahrlos mehrfach ausgeführt werden, ohne bestehende Daten zu überschreiben.

CREATE TABLE IF NOT EXISTS "applications" (
	"id" serial PRIMARY KEY,
	"full_name" text NOT NULL,
	"age" text NOT NULL,
	"phone" text NOT NULL,
	"position" text NOT NULL,
	"motivation" text NOT NULL,
	"experience" text NOT NULL,
	"guest_experience" text NOT NULL,
	"availability" text NOT NULL,
	"contact_preference" text NOT NULL,
	"status" text DEFAULT 'neu' NOT NULL,
	"admin_notes" text DEFAULT '' NOT NULL,
	"application_folder" text DEFAULT 'neu' NOT NULL,
	"custom_answers" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "team_members" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"expertise" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "contact_requests" (
	"id" serial PRIMARY KEY,
	"name_or_company" text NOT NULL,
	"contact_method" text NOT NULL,
	"request_type" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"folder" text DEFAULT 'neu' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "menu_items" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"price" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "events" (
  "id" serial PRIMARY KEY,
  "event_date" text NOT NULL,
  "start_time" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'in-planung' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "site_settings" (
  "key" text PRIMARY KEY,
  "value" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "content_blocks" (
  "id" serial PRIMARY KEY,
  "section" text DEFAULT 'home' NOT NULL,
  "title" text NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Beispiel-Team-Mitglieder nur einfügen, wenn die Tabelle noch komplett leer ist
-- (verhindert Duplikate bei mehrfachem Ausführen dieses Skripts).
INSERT INTO "team_members" ("name", "role", "expertise", "description", "sort_order")
SELECT * FROM (VALUES
	('Jay Jackson', 'Owner', 'Nightlife-Strategie & Event-Konzeption', 'Der Kopf hinter dem Neon-Traum. Verantwortet das Booking und das exklusive Business-Netzwerk.', 10),
	('Isaac Miller', 'Co-Owner', 'Operation & Security-Management', 'Das Herz des Bahama Mamas. Spezialist für Sicherheit und sorgt für den perfekten Ablauf.', 20)
) AS seed(name, role, expertise, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM "team_members");
