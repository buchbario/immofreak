# Supabase-Setup für ImmoFreak

Schritt-für-Schritt-Anleitung. Nach einmaliger Einrichtung läuft alles automatisch.

---

## 1. Supabase-Projekt anlegen (5 Min)

1. Auf https://supabase.com → **Start your project** → mit GitHub einloggen
2. **New project** → in einer Organisation
3. Eingaben:
   - **Name**: `immofreak` (oder wie du willst)
   - **Database Password**: starkes Passwort generieren (Passwort-Manager nutzen — du brauchst es nur, wenn du direkt auf die DB zugreifst)
   - **Region**: **Frankfurt (eu-central-1)** ← wichtig für DSGVO + Latenz
   - **Plan**: Free reicht zum Start (500 MB DB, bis zu 50.000 monthly active users)
4. **Create new project** → 1–2 Min warten

---

## 2. SQL-Schema ausführen (1 Min)

1. Im Supabase-Dashboard links: **SQL Editor** → **New query**
2. Den **kompletten Inhalt** von `supabase/migrations/0001_init.sql` (im Repo) reinkopieren
3. **Run** drücken
4. Prüfen: links auf **Table Editor** klicken — du solltest jetzt ~27 Tabellen sehen (`projects`, `contractors`, `tenants`, `tasks` …)

> Damit sind alle Tabellen + Indizes + Row-Level-Security-Policies + Trigger angelegt. Jeder Nutzer sieht durch RLS **garantiert nur seine eigenen Daten** — auch wenn ein anderer Nutzer die User-ID kennt.

---

## 3. .env-Datei im Projekt anlegen (1 Min)

1. Im Supabase-Dashboard: **Project Settings → API**
2. Kopiere:
   - **Project URL** (z. B. `https://abcd.supabase.co`)
   - **anon / public**-Key (langer JWT-String)
3. Im Repo-Ordner eine Datei `.env` anlegen (NICHT `.env.example` umbenennen!):

   ```env
   VITE_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbG...
   ```

4. Dev-Server neu starten (`npm run dev`)

> Der **anon-Key** ist OK im Frontend — er bekommt ohne Login keine Daten. RLS schützt alles. Den **service_role**-Key NIEMALS im Frontend verwenden.

---

## 4. Auth aktivieren + E-Mail-Bestätigung (2 Min)

1. **Authentication → Providers → Email**
   - **Enable Email provider**: ✅ ON
   - **Confirm email**: ✅ ON (Pflicht — sonst kann jeder mit beliebiger Mail registrieren)
   - **Secure email change**: ✅ ON
2. **Authentication → URL Configuration**
   - **Site URL**: deine Production-URL (z. B. `https://crm.deinedomain.de`)
   - **Redirect URLs** (mehrere erlaubt, eine pro Zeile):
     ```
     http://localhost:5173/**
     https://crm.deinedomain.de/**
     ```
   - Wenn du auf Vercel deployst, auch `https://*-deintenant.vercel.app/**` ergänzen
3. **Authentication → Rate Limits**: Default reicht. Bei viel Traffic später anpassen.

---

## 5. SMTP — eigene E-Mail-Adresse, nicht im Spam (10 Min)

> ⚠️ Ohne eigene SMTP nutzt Supabase eine Test-Domain (`@supabase.io`) mit harten Limits (3 Mails/h) — und die landen fast garantiert im Spam.

### Welcher Provider?

Drei sinnvolle Optionen — wähle eine:

| Provider | Preis | Wie schnell | Empfohlen für |
|---|---|---|---|
| **Resend** | 100/Tag gratis, dann ab $20/Mo | 5 Min | Empfehlung — modern, einfach, gute Deliverability |
| **Brevo** (ex Sendinblue) | 300/Tag gratis | 10 Min | Wer mehr Volumen gratis will |
| **Postmark** | 7-Tage-Trial, dann ab $15/Mo | 10 Min | Beste Deliverability für transaktionale Mails |

Ich beschreibe **Resend** im Detail, der Rest funktioniert analog.

### 5a. Resend einrichten

1. Account auf https://resend.com erstellen
2. **Domains → Add Domain** → deine Domain (z. B. `deinedomain.de`)
3. Resend zeigt dir DNS-Records — bei deinem Domain-Hoster (Strato, IONOS, Cloudflare …) eintragen:
   - **MX**-Record (für Bounces)
   - **TXT**-Record für **SPF** (z. B. `v=spf1 include:amazonses.com ~all`)
   - **TXT**-Record für **DKIM** (langer Key)
   - **TXT**-Record für **DMARC** (z. B. `v=DMARC1; p=none; rua=mailto:dmarc@deinedomain.de`)
4. In Resend auf **Verify Domain** klicken — kann 5–60 Min dauern
5. **API Keys → Create API Key** → Name `supabase-smtp` → Permission `Sending access` → kopieren

> 💡 SPF + DKIM + DMARC sind DER Grund, warum Mails entweder im Posteingang oder im Spam landen. Ohne diese Records sieht jeder Mailserver "diese Mail könnte gefälscht sein" → Spam. Mit den Records ist die Reputation hoch.

### 5b. SMTP in Supabase eintragen

1. **Project Settings → Authentication → SMTP Settings → Enable Custom SMTP**: ON
2. Felder ausfüllen (Resend-Beispiel):
   - **Sender email**: `noreply@deinedomain.de` (muss zu verifizierter Domain passen)
   - **Sender name**: `ImmoFreak`
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: dein Resend-API-Key
   - **Minimum interval between emails**: `60` (Sekunden — Anti-Spam)
3. **Save**
4. **Authentication → Emails** → **Send a test email** → ankommen prüfen (auch in Spam)

### 5c. E-Mail-Templates anpassen (optional)

Im Supabase-Dashboard: **Authentication → Email Templates**

- **Confirm signup**: Standardtext anpassen, Logo einfügen, deutscher Text
- **Reset password**: dito
- **Magic Link**: nicht relevant (wir nutzen Password-Login)

Beispiel-Template für Confirm signup (HTML):

```html
<h2>Willkommen bei ImmoFreak!</h2>
<p>Klicke auf den Link, um deine E-Mail-Adresse zu bestätigen:</p>
<p><a href="{{ .ConfirmationURL }}">E-Mail bestätigen</a></p>
<p>Falls du dich nicht registriert hast, ignoriere diese E-Mail.</p>
```

---

## 6. Erstes Konto anlegen + testen

1. Dev-Server starten: `npm run dev`
2. http://localhost:5173/signup öffnen
3. Konto mit echter E-Mail erstellen
4. In dein E-Mail-Postfach schauen (auch Spam!) → Bestätigungs-Link klicken
5. Du wirst auf `/login` umgeleitet → einloggen
6. Im Supabase-Dashboard: **Table Editor → projects** → ein Projekt anlegen → es taucht als Zeile mit deiner `user_id` auf

### RLS testen

1. Zweites Konto mit anderer E-Mail registrieren
2. Einloggen → du siehst die Projekte des ersten Kontos **nicht** ✅
3. Beweis: Im SQL-Editor `select * from projects;` ausführen — als Service-Role siehst du alle Projekte beider User, im Frontend nur die eigenen.

---

## 7. Production-Deployment (Vercel)

1. In Vercel: **Project → Settings → Environment Variables**
   - `VITE_SUPABASE_URL` = deine Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = anon-Key
2. Im Supabase-Dashboard: **Authentication → URL Configuration → Redirect URLs** um die Vercel-URL ergänzen
3. Redeploy

---

## Troubleshooting

| Problem | Lösung |
|---|---|
| "Invalid login credentials" obwohl PW richtig | E-Mail noch nicht bestätigt → Mailbox checken (auch Spam) |
| Mail kommt nie an | SMTP-Settings prüfen, in Supabase-Dashboard **Logs → Auth Logs** schauen |
| Mail im Spam | DKIM/SPF/DMARC nicht verifiziert — Resend-Dashboard checken |
| "Failed to fetch" beim Login | `.env` falsch oder Dev-Server nicht neu gestartet |
| User sieht Daten anderer User | RLS-Policy nicht aktiv — SQL `0001_init.sql` nochmal ausführen |
| TypeScript-Fehler `crypto.randomUUID is not a function` | Vite auf `target: 'es2022'` setzen |

---

## Was ist im Code passiert?

| Datei | Änderung |
|---|---|
| `supabase/migrations/0001_init.sql` | **NEU** — komplettes DB-Schema + RLS |
| `src/lib/supabase.ts` | **NEU** — Supabase-Client |
| `src/lib/caseMapping.ts` | **NEU** — camelCase ↔ snake_case |
| `src/lib/storage.ts` | **Umgestellt** — `SupabaseAdapter` statt `LocalStorageAdapter`. Gleiches Interface → alle 24 Hooks unverändert. |
| `src/lib/utils.ts` | `generateId()` jetzt UUID v4 (kompatibel mit Postgres `uuid`) |
| `src/context/AuthContext.tsx` | **Umgestellt** — echtes Supabase Auth (signIn/signUp/signOut/resetPassword) |
| `src/components/auth/LoginPage.tsx` | Echtes Login statt Demo. Links zu Signup + Passwort-Reset. |
| `src/components/auth/SignupPage.tsx` | **NEU** — Registrierung mit Bestätigungs-Hinweis |
| `src/components/auth/ResetPasswordPage.tsx` | **NEU** — Passwort vergessen + neues Passwort |
| `src/components/auth/AuthGuard.tsx` | Loading-State während Session-Check |
| `src/router.tsx` | Routes für `/signup`, `/reset-password` |
| `.env.example` | **NEU** |
| `.gitignore` | `.env` hinzugefügt |

## Was bleibt unverändert?

Alle 24 Hooks (`useProjects`, `useTenants`, …) und alle Komponenten — der `SupabaseAdapter` hat das gleiche Interface wie der `LocalStorageAdapter`. Beim Umstellen war kein Komponenten-Touch nötig.
