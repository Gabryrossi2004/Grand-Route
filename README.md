# Gestionale Viaggi

Gestionale per creare itinerari di viaggio e condividerli con i clienti tramite una
pagina pubblica brandizzata (logo e colori dell'agenzia), ispirato a Travefy.

## Stack tecnologico

- **Next.js** (React) — frontend e backend nello stesso progetto
- **Supabase** — database Postgres, login utenti, storage dei file caricati
- **Tailwind CSS** — stile
- **Vercel** — hosting

## Come far girare il progetto sul tuo computer

1. Installa le dipendenze:

   ```bash
   npm install
   ```

2. Crea un progetto su [supabase.com](https://supabase.com), poi vai in
   **Project Settings → API** e copia **Project URL** e **anon public key**.

3. Copia `.env.example` in un nuovo file `.env.local` e incolla i due valori:

   ```bash
   cp .env.example .env.local
   ```

4. Apri il progetto Supabase, vai su **SQL Editor → New query**, incolla tutto il
   contenuto di `supabase/schema.sql` e premi **Run**. Questo crea tutte le
   tabelle e le regole di sicurezza.

5. Avvia il sito in locale:

   ```bash
   npm run dev
   ```

   e apri [http://localhost:3000](http://localhost:3000).

## Pubblicare online

Il progetto è pensato per essere pubblicato su [Vercel](https://vercel.com):
collega il repository GitHub, aggiungi le stesse variabili d'ambiente di
`.env.local` nelle impostazioni del progetto Vercel, e ogni push su `main`
pubblica automaticamente una nuova versione.
