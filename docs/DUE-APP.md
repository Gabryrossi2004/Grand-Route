# Grand Route — due ingressi, poi due app

Oggi c'è **un solo sito** (grandroute.it) con **due porte d'accesso separate**:

| Porta | Indirizzo | Chi entra | Dove porta |
|---|---|---|---|
| **Professionisti** | `/professionisti` | agenzie, tour operator, agenzie locali, guide, autisti, strutture, fornitori | `/dashboard` (o `/rete/home` per i fornitori) |
| **Clienti** | `/clienti` | clienti di un'agenzia e chi organizza il viaggio da solo (un solo accesso) | `/client` (clienti di agenzia) o `/viaggiatore` (fai-da-te) |

- La pagina iniziale `/` è una scelta fra le due porte.
- I vecchi indirizzi (`/login`, `/client/login`, `/viaggiatore/login`) portano alla porta giusta (i link già inviati continuano a funzionare).
- Ogni porta controlla chi entra: un cliente che prova ad entrare dai Professionisti (o viceversa) viene scollegato con un messaggio che lo manda alla porta giusta.
- Le regole su «quale pagina appartiene a quale area» stanno **solo** in `src/lib/areas.ts`.

## Separare davvero in due siti (quando vorrai)

Il codice è già pronto: basta configurare, **senza modificare il programma**.

1. **Vercel → Progetto → Settings → Domains:** aggiungi i due indirizzi allo stesso progetto, per esempio
   - `pro.grandroute.it` per i professionisti
   - `grandroute.it` (e `www`) per i clienti
2. **Vercel → Settings → Environment Variables** (Production), poi nuovo deploy:
   - `NEXT_PUBLIC_PRO_HOST` = `pro.grandroute.it`
   - `NEXT_PUBLIC_CLIENT_HOST` = `grandroute.it`
   (solo il nome del sito, senza `https://`; devono essere diversi. Se manca una delle due, tutto resta su un sito solo.)
3. **Supabase → Authentication → URL Configuration:** aggiungi entrambi gli indirizzi (`https://pro.grandroute.it/**` e `https://grandroute.it/**`) fra i *Redirect URLs*; il *Site URL* resta quello principale. Controlla anche i modelli email (conferma, recupero password).
4. Cosa succede: su `pro.…` la pagina iniziale è direttamente l'accesso Professionisti e le pagine clienti rimandano a `grandroute.it`; su `grandroute.it` la pagina iniziale è l'accesso Clienti e le pagine dei professionisti rimandano a `pro.…`. Le pagine condivise (viaggi pubblici `/t/…`, `/privacy`, `/termini`, recupero password, API) rispondono su entrambi.
5. **Attenzione:** l'accesso è per sito. Chi usa entrambe le aree (es. un'agenzia che prova la vista cliente) deve accedere separatamente su ciascun sito. Le email già inviate con link a `/client/...` o `/login` vengono rimandate al sito giusto.

## Per fare due app vere (dopo)
- Due progetti Vercel dallo stesso repository (o due cartelle), ognuno con il suo manifest/PWA e le sue icone: la scheda «installa» dei Professionisti e quella dei Clienti saranno distinte.
- Le notifiche push sono per sito: vanno rieffettuate (iscrizione) su ciascuno.
- Il database Supabase resta uno solo.
