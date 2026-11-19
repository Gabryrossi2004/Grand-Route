-- Codice viaggio: 6 caratteri (lettere e numeri senza 0/O e 1/I, per non confonderli), unico per agenzia.
-- Si crea da solo per ogni nuovo viaggio (anche varianti e copie) e serve a ritrovarlo al volo,
-- per esempio nella scheda operativa «day by day».
alter table public.trips add column if not exists code text;
alter table public.ops_rows add column if not exists trip_code text not null default '';

create or replace function public.gen_trip_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
begin
  for i in 1..6 loop
    result := result || substr(chars, 1 + floor(random() * 32)::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.trips_assign_code()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  c text;
begin
  if tg_op = 'UPDATE' then
    -- il codice non cambia mai
    new.code := coalesce(old.code, new.code);
    return new;
  end if;
  loop
    c := public.gen_trip_code();
    exit when not exists (select 1 from public.trips t where t.owner_id = new.owner_id and t.code = c);
  end loop;
  new.code := c;
  return new;
end;
$$;

-- codici per i viaggi già esistenti
do $$
declare
  r record;
  c text;
begin
  for r in select id, owner_id from public.trips where code is null loop
    loop
      c := public.gen_trip_code();
      exit when not exists (select 1 from public.trips t where t.owner_id = r.owner_id and t.code = c);
    end loop;
    update public.trips set code = c where id = r.id;
  end loop;
end;
$$;

drop trigger if exists trips_assign_code on public.trips;
create trigger trips_assign_code
  before insert or update of code on public.trips
  for each row execute function public.trips_assign_code();

create unique index if not exists trips_owner_code_idx on public.trips (owner_id, code);

-- righe della scheda operativa già importate: prendono il codice del loro viaggio
update public.ops_rows o set trip_code = t.code from public.trips t where o.trip_id = t.id and o.trip_code = '';
