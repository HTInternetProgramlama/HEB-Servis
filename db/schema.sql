-- HEB Servis · Araç Bakım ve Servis Yönetim Sistemi
-- PostgreSQL 15+ şeması (Supabase üzerinde çalışacak şekilde). Uygulama henüz bu şemaya bağlı değildir;
-- yerel sürümdeki iş kuralları (lib/rules.ts) burada kısıt ve politika olarak karşılanır.
-- Para: numeric(12,2) yerine kuruş cinsinden bigint. Miktar: yüzde birlik integer (1,5 = 150).

create extension if not exists btree_gist;

create type user_role as enum ('admin', 'advisor', 'technician', 'customer');
create type appointment_status as enum ('Bekliyor', 'Onaylı', 'Geldi', 'İş emri açıldı', 'İptal', 'Gelmedi');
create type job_status as enum ('Kabul edildi', 'İnceleniyor', 'Onay bekliyor', 'İşlemde', 'Parça bekliyor', 'Son kontrol', 'Teslime hazır', 'Teslim edildi', 'İptal');
create type estimate_status as enum ('Taslak', 'Gönderildi', 'Onaylandı', 'Reddedildi', 'Geçersiz');
create type channel as enum ('Portal', 'Telefon', 'Şube');
create type inspection_result as enum ('Uygun', 'Takip edilmeli', 'Acil');
create type line_kind as enum ('Parça', 'İşçilik');
create type payment_method as enum ('Nakit', 'Kredi kartı', 'Havale/EFT');

-- Ayarlar ve kaynaklar ------------------------------------------------------
create table settings (
  id smallint primary key default 1 check (id = 1),
  company jsonb not null,
  work_start time not null, work_end time not null, break_start time not null, break_end time not null,
  work_days smallint[] not null,
  vat_rate smallint not null check (vat_rate between 0 and 50),
  service_interval_km integer not null, service_interval_months smallint not null,
  check (work_start < break_start and break_start < break_end and break_end < work_end)
);
create table resources (id uuid primary key default gen_random_uuid(), name text not null, kind text not null, active boolean not null default true);
create table catalog_items (
  id uuid primary key default gen_random_uuid(), kind line_kind not null, code text not null unique, name text not null,
  unit text not null, unit_price bigint not null check (unit_price >= 0), active boolean not null default true
);
create table service_types (id uuid primary key default gen_random_uuid(), name text not null, duration_min smallint not null check (duration_min between 15 and 480));
create table service_type_items (service_type_id uuid references service_types on delete cascade, catalog_item_id uuid references catalog_items, primary key (service_type_id, catalog_item_id));

-- Kişiler -------------------------------------------------------------------
create table customers (
  id uuid primary key default gen_random_uuid(), no text not null unique, kind text not null check (kind in ('Bireysel', 'Kurumsal')),
  name text not null check (length(trim(name)) >= 3), phone text not null, email text, address text, tax_no text,
  preference text not null check (preference in ('Telefon', 'SMS', 'E-posta')),
  consent boolean not null check (consent), created_at timestamptz not null default now(),
  check (kind = 'Bireysel' or tax_no ~ '^\d{10}$')
);
create unique index customers_phone_uq on customers (regexp_replace(phone, '\D', '', 'g'));

-- Supabase Auth kullanıcısı ile eşleşen profil. Rol istemciden değil bu tablodan okunur.
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null, email text not null unique, phone text, role user_role not null,
  customer_id uuid references customers, active boolean not null default true,
  check ((role = 'customer') = (customer_id is not null))
);

create table vehicles (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references customers,
  plate text not null unique check (plate ~ '^\d{2}[A-ZÇĞİÖŞÜ]{1,3}\d{2,5}$'),
  brand text not null, model text not null, year smallint not null check (year >= 1950),
  km integer not null check (km >= 0), vin text check (vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  fuel text not null, transmission text not null, color text,
  next_service_date date, next_service_km integer, created_at timestamptz not null default now()
);

-- Randevu: onaylı randevular aynı alanda çakışamaz (BK-01) --------------------
create table appointments (
  id uuid primary key default gen_random_uuid(), no text not null unique,
  customer_id uuid not null references customers, vehicle_id uuid not null references vehicles,
  service_type_id uuid not null references service_types, resource_id uuid not null references resources,
  starts_at timestamptz not null, ends_at timestamptz not null, status appointment_status not null default 'Bekliyor',
  note text check (length(note) <= 500), source channel not null, created_at timestamptz not null default now(), created_by uuid references profiles,
  check (ends_at > starts_at),
  constraint appointments_no_overlap exclude using gist (resource_id with =, tstzrange(starts_at, ends_at) with &&)
    where (status in ('Onaylı', 'Geldi', 'İş emri açıldı'))
);

-- İş emri -------------------------------------------------------------------
create table jobs (
  id uuid primary key default gen_random_uuid(), no text not null unique,
  appointment_id uuid unique references appointments, -- aynı randevudan ikinci iş emri açılamaz (BK-02)
  customer_id uuid not null references customers, vehicle_id uuid not null references vehicles,
  service_type_id uuid not null references service_types,
  advisor_id uuid not null references profiles, technician_id uuid not null references profiles,
  status job_status not null default 'Kabul edildi',
  intake_km integer not null, intake_fuel smallint not null check (intake_fuel between 0 and 8),
  complaint text not null, damages jsonb not null default '[]', belongings text, customer_ack boolean not null check (customer_ack),
  promised_at timestamptz not null, delivered_at timestamptz, delivery_note text, created_at timestamptz not null default now()
);
create unique index jobs_one_open_per_vehicle on jobs (vehicle_id) where status not in ('Teslim edildi', 'İptal');

create table job_status_events (id bigserial primary key, job_id uuid not null references jobs on delete cascade, status job_status not null, note text, at timestamptz not null default now(), by uuid not null references profiles);

create table inspections (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references jobs on delete cascade,
  item text not null, result inspection_result not null, note text, customer_visible boolean not null default true,
  source text not null default 'Teknisyen', photo_path text, -- özel Storage alanındaki dosya
  at timestamptz not null default now(), by uuid not null references profiles
);

-- Teklif: sürümler değiştirilemez; değişiklik yeni sürüm üretir (BK-05) ---------
create table estimates (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references jobs on delete cascade,
  version smallint not null, status estimate_status not null default 'Taslak', vat_rate smallint not null, note text,
  created_at timestamptz not null default now(), created_by uuid not null references profiles, sent_at timestamptz,
  decision_result estimate_status check (decision_result in ('Onaylandı', 'Reddedildi')), decision_channel channel,
  decision_note text, decision_by uuid references profiles, decision_at timestamptz,
  unique (job_id, version),
  check (decision_channel is null or decision_channel = 'Portal' or length(decision_note) >= 5)
);
create unique index estimates_one_draft on estimates (job_id) where status = 'Taslak';
create unique index estimates_one_open on estimates (job_id) where status = 'Gönderildi';

create table estimate_lines (
  id uuid primary key default gen_random_uuid(), estimate_id uuid not null references estimates on delete cascade,
  kind line_kind not null, code text, name text not null, unit text not null,
  qty integer not null check (qty > 0), unit_price bigint not null check (unit_price >= 0),
  discount_pct smallint not null default 0 check (discount_pct between 0 and 100)
);

-- Taslak dışındaki sürümlerin kalemleri değiştirilemez.
create function forbid_locked_lines() returns trigger language plpgsql as $$
begin
  if (select status from estimates where id = coalesce(new.estimate_id, old.estimate_id)) <> 'Taslak' then
    raise exception 'Gönderilmiş teklif sürümü değiştirilemez; yeni sürüm oluşturun.';
  end if;
  return coalesce(new, old);
end $$;
create trigger estimate_lines_locked before insert or update or delete on estimate_lines for each row execute function forbid_locked_lines();

-- Satır ve teklif toplamları kuruş doğruluğunda (BK-06)
create view estimate_totals as
select e.id as estimate_id, e.job_id, e.version, e.status,
  sum(l.net) filter (where l.kind = 'Parça') as parts, sum(l.net) filter (where l.kind = 'İşçilik') as labor,
  sum(l.net) as subtotal, round(sum(l.net) * e.vat_rate / 100.0)::bigint as vat,
  sum(l.net) + round(sum(l.net) * e.vat_rate / 100.0)::bigint as total
from estimates e
join lateral (
  select kind, round(qty * unit_price / 100.0)::bigint - round(round(qty * unit_price / 100.0) * discount_pct / 100.0)::bigint as net
  from estimate_lines where estimate_id = e.id
) l on true
group by e.id;

-- Tahsilat: aynı işlem anahtarı ikinci kayıt üretmez (FR-09) --------------------
create table payments (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references jobs, idempotency_key text not null unique,
  amount bigint not null check (amount > 0), method payment_method not null, note text,
  at timestamptz not null default now(), by uuid not null references profiles
);

-- Müşteri ilişkileri (yalnız personel) -------------------------------------------
create table customer_notes (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references customers, job_id uuid references jobs,
  category text not null, text text not null check (length(text) between 3 and 1000),
  at timestamptz not null default now(), by uuid not null references profiles
);
create table customer_note_revisions (id bigserial primary key, note_id uuid not null references customer_notes on delete cascade, previous_text text not null, at timestamptz not null default now(), by uuid not null references profiles);
create table visit_evaluations (
  id uuid primary key default gen_random_uuid(), job_id uuid not null unique references jobs, customer_id uuid not null references customers,
  punctuality smallint not null check (punctuality between 1 and 5), payment smallint not null check (payment between 1 and 5),
  communication smallint not null check (communication between 1 and 5), reason text not null, at timestamptz not null default now(), by uuid not null references profiles
);
create table reminder_logs (id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references vehicles, result text not null, note text, at timestamptz not null default now(), by uuid not null references profiles);
create table audit_log (id bigserial primary key, at timestamptz not null default now(), by uuid references profiles, action text not null, ref text);

-- Satır düzeyi güvenlik (BK-03, BK-04) -------------------------------------------
create function my_role() returns user_role language sql stable security definer set search_path = public as $$ select role from profiles where id = auth.uid() and active $$;
create function my_customer() returns uuid language sql stable security definer set search_path = public as $$ select customer_id from profiles where id = auth.uid() and active $$;
create function is_staff() returns boolean language sql stable as $$ select my_role() in ('admin', 'advisor') $$;

alter table customers enable row level security;
alter table vehicles enable row level security;
alter table appointments enable row level security;
alter table jobs enable row level security;
alter table inspections enable row level security;
alter table estimates enable row level security;
alter table estimate_lines enable row level security;
alter table payments enable row level security;
alter table customer_notes enable row level security;
alter table customer_note_revisions enable row level security;
alter table visit_evaluations enable row level security;

create policy staff_all on customers for all using (is_staff()) with check (is_staff());
create policy own_read on customers for select using (id = my_customer());

create policy staff_all on vehicles for all using (is_staff()) with check (is_staff());
create policy tech_read on vehicles for select using (my_role() = 'technician');
create policy own_read on vehicles for select using (customer_id = my_customer());

create policy staff_all on appointments for all using (is_staff()) with check (is_staff());
create policy own_read on appointments for select using (customer_id = my_customer());
create policy own_request on appointments for insert with check (customer_id = my_customer() and status = 'Bekliyor' and source = 'Portal'
  and exists (select 1 from vehicles v where v.id = vehicle_id and v.customer_id = my_customer()));

create policy staff_all on jobs for all using (is_staff()) with check (is_staff());
create policy tech_assigned on jobs for select using (technician_id = auth.uid());
create policy own_read on jobs for select using (customer_id = my_customer());

create policy staff_all on inspections for all using (is_staff()) with check (is_staff());
create policy tech_assigned on inspections for all using (exists (select 1 from jobs j where j.id = job_id and j.technician_id = auth.uid()))
  with check (exists (select 1 from jobs j where j.id = job_id and j.technician_id = auth.uid()));
create policy own_visible on inspections for select using (customer_visible and exists (select 1 from jobs j where j.id = job_id and j.customer_id = my_customer()));

create policy staff_all on estimates for all using (is_staff()) with check (is_staff());
create policy tech_read on estimates for select using (exists (select 1 from jobs j where j.id = job_id and j.technician_id = auth.uid()));
create policy own_sent on estimates for select using (status <> 'Taslak' and exists (select 1 from jobs j where j.id = job_id and j.customer_id = my_customer()));
-- Müşteri kararı doğrudan güncelleme yerine decide_estimate() sunucu fonksiyonuyla verilir.

create policy staff_all on estimate_lines for all using (is_staff()) with check (is_staff());
create policy visible_with_estimate on estimate_lines for select using (exists (select 1 from estimates e where e.id = estimate_id));

create policy staff_all on payments for all using (is_staff()) with check (is_staff());
create policy own_read on payments for select using (exists (select 1 from jobs j where j.id = job_id and j.customer_id = my_customer()));

-- İç notlar ve değerlendirmeler: yalnız yönetici ve danışman; müşteri ve teknisyen için politika yoktur.
create policy staff_only on customer_notes for all using (is_staff()) with check (is_staff());
create policy staff_only on customer_note_revisions for all using (is_staff()) with check (is_staff());
create policy staff_only on visit_evaluations for all using (is_staff()) with check (is_staff());

-- Müşterinin teklif kararı: yalnız kendi işinin güncel ve gönderilmiş sürümüne (FR-08)
create function decide_estimate(p_estimate uuid, p_result estimate_status) returns void language plpgsql security definer set search_path = public as $$
declare e estimates; j jobs; latest smallint;
begin
  select * into e from estimates where id = p_estimate for update;
  select * into j from jobs where id = e.job_id for update;
  if my_role() <> 'customer' or j.customer_id <> my_customer() then raise exception 'Bu teklif size ait değil.'; end if;
  select max(version) into latest from estimates where job_id = e.job_id;
  if e.version <> latest or e.status <> 'Gönderildi' then raise exception 'Bu teklif sürümü artık geçerli değil.'; end if;
  if p_result not in ('Onaylandı', 'Reddedildi') then raise exception 'Geçersiz karar.'; end if;
  update estimates set status = p_result, decision_result = p_result, decision_channel = 'Portal', decision_by = auth.uid(), decision_at = now() where id = e.id;
  if p_result = 'Onaylandı' then
    update jobs set status = 'İşlemde' where id = j.id;
    insert into job_status_events (job_id, status, note, by) values (j.id, 'İşlemde', 'Teklif v' || e.version || ' onaylandı (Portal)', auth.uid());
  end if;
end $$;
