# Copia di sicurezza del database

## Cosa fa
Ogni notte (02:17 UTC) GitHub copia il database di Grand Route (tabelle, utenti
e indice dei file), lo cifra e lo conserva per 30 giorni. È in più rispetto alle
copie automatiche di Supabase (che nel piano gratuito non ci sono).

**Non copia le foto e i documenti** (cartelle `public-assets` e `trip-documents`
dello Storage di Supabase): quelli restano solo su Supabase. Vedi "Limiti".

## Messa in funzione (una volta sola)

1. **Indirizzo del database (Session pooler)**
   Supabase → pulsante **Connect** in alto → scheda **Session pooler** (non
   "Direct connection": GitHub non supporta quell'indirizzo). Copia l'indirizzo,
   che ha questa forma:
   `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-eu-....pooler.supabase.com:5432/postgres`
   e sostituisci `[YOUR-PASSWORD]` con la password del database (quella nel
   gestore di password). Se la password contiene simboli come `@ : / ? # %`,
   vanno scritti in codice (es. `@` → `%40`).

2. **Password di cifratura**
   Scegli una frase lunga e casuale (almeno 20 caratteri) e **salvala nel
   gestore di password** come "Grand Route – password backup". Senza questa
   password le copie non si possono aprire.

3. **Inserisci i due Secrets su GitHub**
   Repository → **Settings → Secrets and variables → Actions → New repository
   secret**:
   - `SUPABASE_DB_URL` = l'indirizzo del punto 1 (con la password dentro)
   - `BACKUP_PASSPHRASE` = la password del punto 2

4. **Prima prova**
   **Actions → Backup database → Run workflow**. Dopo 1-2 minuti deve diventare
   verde. In fondo alla pagina della corsa, sotto **Artifacts**, compare il
   file `grandroute-db-AAAA-MM-GG`.

## Come aprire una copia
Scarica l'artifact (è uno zip con dentro il file `.enc`), poi da terminale:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in grandroute-db-AAAA-MM-GG.sql.gz.enc -out backup.sql.gz
gunzip backup.sql.gz
```

Ottieni `backup.sql`, un file di testo con tutti i dati.

## Come ripristinare (in caso di disastro)
1. Crea un nuovo progetto Supabase (o svuota quello esistente).
2. Esegui prima `supabase/setup_completo.sql` (crea la struttura), poi importa
   i dati del backup con `psql`. Per il ripristino chiedi aiuto: i dati si
   importano nell'ordine giusto e va riallineato lo Storage.

## Limiti
- Le **foto e i documenti** non sono inclusi. Quando i file saranno tanti si
  aggiunge una copia periodica dello Storage su un secondo servizio.
- GitHub **conserva gli artifact al massimo 90 giorni**; qui sono 30.
- Se l'account GitHub non fosse più accessibile, le copie sparirebbero con
  esso: ogni tanto scarica una copia e tienila anche altrove (disco o cloud).
- Se il repository restasse inattivo a lungo, GitHub può sospendere le
  esecuzioni programmate: controlla ogni tanto che le corse siano verdi.
