# Umzug von Netlify zu Vercel + Supabase

Dieses Projekt wurde umgebaut, damit es auf **Vercel** läuft und ausschließlich
**Supabase** als Datenbank nutzt. Es geht nichts mehr in Richtung Netlify.

## Was wurde geändert?

1. **`netlify/functions/*.mts`** (Netlify Functions) → verschoben nach **`api/*.ts`**
   (Vercel erkennt den Ordner `api/` automatisch und macht daraus Serverless
   Functions, z. B. wird `api/menu.ts` zu `/api/menu`).
2. **`db/index.ts`**: nutzte vorher `drizzle-orm/netlify-db` (Netlifys eigene,
   jetzt pausierte Datenbank). Nutzt jetzt `drizzle-orm/postgres-js` mit einer
   ganz normalen Postgres-Connection-String aus Supabase.
3. **Login/Admin-Bereich**: nutzte vorher **Netlify Identity** (ein reiner
   Netlify-Dienst, der außerhalb von Netlify gar nicht funktionieren kann).
   Das läuft jetzt über **Supabase Auth**.
4. **`netlify.toml`** und der komplette `netlify/`-Ordner wurden entfernt.
5. Die SQL-Migrationen wurden zu einem einzigen Skript zusammengefasst:
   `migrations/000_supabase_setup.sql`.

## Einrichtung – Schritt für Schritt

### 1. Datenbank-Tabellen in Supabase anlegen

Supabase-Dashboard → dein Projekt → **SQL Editor** → "New query" → Inhalt von
`migrations/000_supabase_setup.sql` einfügen → **Run**.

Das Skript ist ungefährlich mehrfach ausführbar (nutzt `IF NOT EXISTS`).

### 2. Connection-String für die Datenbank besorgen

Supabase-Dashboard → **Project Settings** → **Database** → Abschnitt
**Connection string**. Wähle dort **"Transaction pooler"** (Port `6543`) - das
ist die für Serverless-Funktionen empfohlene Variante. Kopiere die URI und
setze dein echtes Datenbank-Passwort ein.

Das ist NICHT die "Publishable Key" URL, sondern ein separater
`postgresql://postgres.xxxx:DEIN-PASSWORT@...pooler.supabase.com:6543/postgres`
String.

### 3. Service Role Key besorgen (nur für den Server, geheim!)

Supabase-Dashboard → **Project Settings** → **API** → Abschnitt
**Project API keys** → **`service_role`** Key kopieren (nicht den
`anon`/`publishable` Key - der ist bereits im Code hinterlegt).

⚠️ Diesen Key niemals im Frontend verwenden oder öffentlich teilen - er hat
vollen Zugriff auf die Datenbank.

### 4. Umgebungsvariablen in Vercel setzen

Vercel-Dashboard → dein Projekt → **Settings** → **Environment Variables**:

| Name | Wert |
|---|---|
| `DATABASE_URL` | Connection-String aus Schritt 2 |
| `SUPABASE_URL` | `https://jqmktlrythfmsxzevkjt.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Key aus Schritt 3 |

Danach: **Redeploy** auslösen (Vercel übernimmt neue Env-Variablen erst beim
nächsten Deployment).

### 5. Admin-Zugang in Supabase anlegen

Supabase Auth ersetzt Netlify Identity. Es gibt noch keinen Admin-Nutzer -
den musst du einmalig anlegen:

1. Supabase-Dashboard → **Authentication** → **Users** → **Add user** →
   E-Mail + Passwort vergeben (Häkchen bei "Auto Confirm User" setzen).
2. Den neu angelegten User anklicken → **Raw App Meta Data** bearbeiten und
   folgendes eintragen:
   ```json
   { "role": "admin" }
   ```
   Speichern.
3. Auf der Website mit dieser E-Mail/Passwort einloggen → der Admin-Bereich
   sollte jetzt sichtbar sein.

Für weitere Admin-Nutzer denselben Schritt wiederholen (User anlegen +
`role: admin` in Raw App Meta Data setzen).

### 6. Lokal testen (optional)

```bash
npm install
npx vercel dev
```

## Warum ging vorher alles Richtung Netlify?

- Die Serverless-Funktionen lagen unter `netlify/functions/` - das kennt nur
  Netlify, Vercel führt diesen Ordner nicht aus. Deswegen liefen alle
  `/api/...`-Aufrufe der Seite ins Leere.
- `db/index.ts` importierte `drizzle-orm/netlify-db`, was automatisch die
  (mittlerweile pausierte) Netlify-eigene Datenbank ansprechen wollte.
- Der Login lief über Netlify Identity, einen Dienst, der ausschließlich auf
  Netlify-Domains funktioniert.

Alle drei Punkte sind jetzt durch Vercel- bzw. Supabase-native Lösungen
ersetzt.
