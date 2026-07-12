# Neue Features: Rollen, Lager, VIP-Tickets, Finanzen, Wichtige Infos

## 1. Datenbank aktualisieren

Einmalig im Supabase SQL Editor ausführen (idempotent, kann gefahrlos mehrfach laufen):

`migrations/001_neue_bereiche.sql`

Legt an: `ingredients`, `recipe_items`, `vip_ticket_types`, `vip_tickets`,
`finance_entries`, `info_notes`, sowie neue Spalten an `menu_items`
(`cost_price`, `stock_target`, `stock_current`, `recipe_visible`).

## 2. Login läuft jetzt über Benutzername statt E-Mail

- Neue Mitarbeiter-Accounts werden über **Nutzer verwalten** im Admin-Bereich
  angelegt (Benutzername + Passwort + Rechte) - kein Supabase-Dashboard mehr
  nötig dafür.
- Dein bestehender allererster Account (mit echter E-Mail-Adresse) funktioniert
  weiterhin unverändert: einfach die komplette E-Mail-Adresse ins
  "Benutzername"-Feld eintippen.
- **Passwort vergessen** gibt es nicht mehr per Mail-Link. Stattdessen:
  - Jeder Mitarbeiter kann im eingeloggten Zustand sein **eigenes Passwort**
    selbst ändern (Button direkt im Admin-Bereich).
  - Eine Person mit Zugriff auf "Nutzer verwalten" kann jedem anderen
    Mitarbeiter ein neues Passwort setzen.

## 3. Rollen & Rechte ("Nutzer verwalten")

Für jeden Mitarbeiter kannst du pro Bereich einzeln festlegen:

- **Kein Zugriff** - Bereich ist für diesen Nutzer komplett unsichtbar
- **Sehen** - kann den Bereich einsehen, aber nichts ändern (Formulare sind
  deaktiviert)
- **Bearbeiten** - voller Zugriff (anlegen, ändern, löschen)

Bereiche: Bewerbungen, Kontaktanfragen, Team, Lager & Preisliste, Events,
VIP-Tickets, Finanzen, Wichtige Infos, Inhalte & Felder, Nutzer verwalten.

Dein bestehender erster Account hat automatisch weiterhin vollen Zugriff auf
alles (Rückwärtskompatibilität), auch ohne dass du dort etwas einstellen
musst.

## 4. Lager & Preisliste (ersetzt die alte Google-Sheets-Tabelle)

- Jeder Speisekarten-Eintrag hat jetzt zusätzlich: Einkaufspreis,
  Soll-/Ist-Bestand. **MAX WIN** und **Fehlt** werden automatisch berechnet.
- Zusätzlich gibt es ein **Zutaten-Lager** für Rohstoffe (Soll/Ist/EK-Preis),
  auch hier werden "Fehlt" und "Kosten Nachbestellung" automatisch berechnet.
- Pro Speisekarten-Eintrag kannst du ein **Rezept** aus den Zutaten
  zusammenstellen. Über die Checkbox "Rezept öffentlich anzeigen" entscheidest
  du pro Eintrag, ob Gäste die Zutatenliste auf der Speisekarte sehen oder ob
  sie nur intern sichtbar bleibt.

## 5. VIP-Tickets

- **Ticket-Arten** (z.B. Bronze/Silber/Gold) mit Preis und Laufzeit in Tagen
  sind frei bearbeitbar.
- **Ticket-Inhaber**: Name, Ticket-Art, Ausstellungsdatum eintragen -
  "Gültig bis", "Tage Rest" und "Aktiv/Abgelaufen" werden automatisch
  berechnet.

## 6. Finanzen

Einfache Ein-/Ausgaben-Liste (Datum, Beschreibung, Betrag - negativ für
Ausgaben). Der laufende Kontostand wird automatisch berechnet und oben
angezeigt.

## 7. Wichtige Infos

Rein interner Hinweis-Bereich für Mitarbeiter (nicht auf der öffentlichen
Seite sichtbar). Hinweise können angepinnt werden, damit sie oben bleiben.
