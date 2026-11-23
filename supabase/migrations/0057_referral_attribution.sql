-- 0057 — Statistiche sui vantaggi: si ricorda chi ha presentato ogni cliente arrivato con «presenta un amico»,
-- così si può contare quanto incassano i clienti portati dagli amici.
--
-- Il sito funziona anche prima di questo passaggio: le statistiche mostrano tutto tranne gli incassi
-- dei clienti presentati.

alter table public.clients
  add column if not exists referred_by_client_id uuid references public.clients (id) on delete set null;
create index if not exists clients_referred_by_idx on public.clients (referred_by_client_id) where referred_by_client_id is not null;

-- Clienti già creati da una richiesta «presenta un amico»: si collegano a chi li aveva presentati
update public.clients c
set referred_by_client_id = l.referrer_client_id
from public.agency_leads l
where l.status = 'cliente'
  and l.referrer_client_id is not null
  and l.owner_id = c.owner_id
  and c.full_name = l.name
  and c.referred_by_client_id is null
  and c.notes like 'Arrivato con «presenta un amico»%';
