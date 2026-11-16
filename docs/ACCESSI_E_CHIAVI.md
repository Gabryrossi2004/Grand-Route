# Grand Route – accessi, chiavi e dove ritrovarle

Questo file NON contiene segreti: dice solo cosa esiste e dove recuperarlo.
I valori veri vanno nel gestore di password (voce "Grand Route – chiavi").

## Account (tutti con verifica in due passaggi attiva)

| Servizio | A cosa serve | Note |
|---|---|---|
| GitHub (nuovo account) | Codice del sito | Salvare i codici di recupero 2FA |
| Vercel | Pubblica il sito (grandroute.it) | Si aggiorna da solo a ogni push su `main` |
| Supabase | Database, login utenti, file | Progetto di Grand Route |
| Resend (nuovo account) | Invio email (mittente `noreply@mail.grandroute.it`) | Registrato con email+password, NON con GitHub |
| Anthropic Console | Generazione itinerari con AI | Chiave `grand-route-produzione` |
| Aruba | Dominio grandroute.it e DNS | Rinnovo automatico + 2FA da attivare |
| RapidAPI / AeroDataBox | Ricerca voli | Da ricreare |

Regola: ogni account va creato con email+password o con un'email personale
che si controlla, MAI con il login "con GitHub" e MAI con email di
università/lavoro che può essere disattivata.

## Variabili d'ambiente (Vercel → progetto → Settings → Environment Variables)

| Nome | Cosa è | Se si perde |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Indirizzo del progetto Supabase | Si rilegge su Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chiave pubblica Supabase (`sb_publishable_…`) | Si rilegge su Supabase → API Keys |
| `CLIENT_DATA_ENCRYPTION_KEY` | Cifra i dati sensibili dei clienti | **NON recuperabile**: senza di essa i dati cifrati sono persi. Tenerne copia. |
| `CRON_SECRET` | Protegge i promemoria giornalieri | Si può rigenerare, va aggiornato anche nel database |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Notifiche push | Rigenerandole, gli utenti devono riattivare le notifiche |
| `ANTHROPIC_API_KEY` | Generazione itinerari con AI | Si crea una nuova chiave su console.anthropic.com |
| `AERODATABOX_API_KEY` | Ricerca voli | Si crea una nuova chiave su RapidAPI |

Opzionali: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`.

Le variabili "Sensitive" di Vercel non si possono rileggere dopo il salvataggio:
per questo i valori vanno copiati nel gestore di password al momento della creazione.

## Altro da conservare
- Password del database Supabase (si può reimpostare in Supabase → Project Settings → Database).
- Codici di recupero 2FA di GitHub, Vercel, Supabase, Resend, Aruba.

## Email (Resend + Supabase)
- Dominio di invio su Resend: `mail.grandroute.it`.
- Record DNS su Aruba (non cancellare): `resend._domainkey.mail` (TXT), `rsend.mail` (CNAME), `send.mail` (CNAME).
- Record vecchi da NON toccare: `resend._domainkey`, `a1._domainkey`, `_vercel`, `_dmarc`, SPF `@`, record di posta Aruba (`mail`, `mx`, MX).
- Supabase → Authentication → Emails → SMTP: host `smtp.resend.com`, porta `465`, utente `resend`, password = chiave API Resend (`supabase-smtp`).

## Dominio
- `grandroute.it` e `www.grandroute.it` puntano a Vercel (Production).
- Supabase → Authentication → URL Configuration: Site URL `https://grandroute.it`; Redirect URLs per `grandroute.it`, `www.grandroute.it` e `grand-route-taupe.vercel.app`.

## Se si perde l'accesso a un account
1. Usare i codici di recupero 2FA salvati.
2. Se GitHub è inaccessibile: Vercel e Supabase restano funzionanti finché non
   serve cambiare il login; collegare subito un'email personale e la password.
3. Il codice del sito è anche sul computer/sessione di lavoro: tenere una copia
   locale aggiornata (`git pull`) del repository.
