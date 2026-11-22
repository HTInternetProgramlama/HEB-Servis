-- HEB Servis · Araç Bakım ve Servis Yönetim Sistemi
-- PostgreSQL 17 / Supabase. Sürüm kontrollü ilk kurulum migration dosyasının kopyası.
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
  note text check (length(note) <= 500), source channel not null, created_at timestamptz not null default now(), created_by uuid references profiles, created_by_name text not null default '',
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
  intake_at timestamptz not null default now(), intake_by uuid references profiles, intake_by_name text not null default '',
  complaint text not null, damages jsonb not null default '[]', belongings text, customer_ack boolean not null check (customer_ack),
  promised_at timestamptz not null, delivered_at timestamptz, delivery_note text, created_at timestamptz not null default now()
);
create unique index jobs_one_open_per_vehicle on jobs (vehicle_id) where status not in ('Teslim edildi', 'İptal');

create table job_status_events (id uuid primary key default gen_random_uuid(), job_id uuid not null references jobs on delete cascade, status job_status not null, note text, at timestamptz not null default now(), by uuid references profiles, by_name text not null default '');

create table inspections (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references jobs on delete cascade,
  item text not null, result inspection_result not null, note text, customer_visible boolean not null default true,
  source text not null default 'Teknisyen', photo_path text, -- özel Storage alanındaki dosya
  at timestamptz not null default now(), by uuid references profiles, by_name text not null default ''
);

-- Teklif: sürümler değiştirilemez; değişiklik yeni sürüm üretir (BK-05) ---------
create table estimates (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references jobs on delete cascade,
  version smallint not null, status estimate_status not null default 'Taslak', vat_rate smallint not null, note text,
  created_at timestamptz not null default now(), created_by uuid references profiles, created_by_name text not null default '', sent_at timestamptz,
  decision_result estimate_status check (decision_result in ('Onaylandı', 'Reddedildi')), decision_channel channel,
  decision_note text, decision_by uuid references profiles, decision_by_name text not null default '', decision_at timestamptz,
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
create function forbid_locked_lines() returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and new.estimate_id is distinct from old.estimate_id then
    raise exception 'Teklif kalemi başka sürüme taşınamaz.';
  end if;
  if (select status from estimates where id = case when TG_OP = 'DELETE' then old.estimate_id else new.estimate_id end) <> 'Taslak' then
    raise exception 'Gönderilmiş teklif sürümü değiştirilemez; yeni sürüm oluşturun.';
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger estimate_lines_locked before insert or update or delete on estimate_lines for each row execute function forbid_locked_lines();

-- Satır ve teklif toplamları kuruş doğruluğunda (BK-06)
create view estimate_totals with (security_invoker = true) as
select e.id as estimate_id, e.job_id, e.version, e.status,
  sum(l.net) filter (where l.kind = 'Parça') as parts, sum(l.net) filter (where l.kind = 'İşçilik') as labor,
  sum(l.net) as subtotal, round(sum(l.net) * e.vat_rate / 100.0)::bigint as vat,
  sum(l.net) + round(sum(l.net) * e.vat_rate / 100.0)::bigint as total
from estimates e
join lateral (
  select kind, round(qty::numeric * unit_price / 100.0)::bigint - round(round(qty::numeric * unit_price / 100.0) * discount_pct / 100.0)::bigint as net
  from estimate_lines where estimate_id = e.id
) l on true
group by e.id;

-- Tahsilat: aynı işlem anahtarı ikinci kayıt üretmez (FR-09) --------------------
create table payments (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references jobs, idempotency_key text not null unique,
  amount bigint not null check (amount > 0), method payment_method not null, note text,
  at timestamptz not null default now(), by uuid references profiles, by_name text not null default ''
);

-- Müşteri ilişkileri (yalnız personel) -------------------------------------------
create table customer_notes (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references customers, job_id uuid references jobs,
  category text not null, text text not null check (length(text) between 3 and 1000),
  at timestamptz not null default now(), by uuid references profiles, by_name text not null default ''
);
create table customer_note_revisions (id uuid primary key default gen_random_uuid(), note_id uuid not null references customer_notes on delete cascade, previous_text text not null, at timestamptz not null default now(), by uuid references profiles, by_name text not null default '');
create table visit_evaluations (
  id uuid primary key default gen_random_uuid(), job_id uuid not null unique references jobs, customer_id uuid not null references customers,
  punctuality smallint not null check (punctuality between 1 and 5), payment smallint not null check (payment between 1 and 5),
  communication smallint not null check (communication between 1 and 5), reason text not null, at timestamptz not null default now(), by uuid references profiles, by_name text not null default ''
);
create table reminder_logs (id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references vehicles, result text not null, note text, at timestamptz not null default now(), by uuid references profiles, by_name text not null default '');
create table audit_log (id uuid primary key default gen_random_uuid(), at timestamptz not null default now(), by uuid references profiles, by_name text not null default '', role user_role not null, action text not null, ref text);


-- Revision and sequential business numbers are locked in the same transaction as writes.
create table app_control (
 id smallint primary key check (id=1), revision bigint not null default 0,
 seq_customer integer not null default 0, seq_appointment integer not null default 0, seq_job integer not null default 0
);
insert into app_control(id) values (1);
create table operation_keys (key uuid primary key, user_id uuid not null references profiles, fingerprint text not null, revision bigint not null, at timestamptz not null default now());

-- Active Supabase identity is the only source of roles. Fixed search_path avoids shadowing.
create function my_role() returns user_role language sql stable security definer set search_path = public as $$
 select role from profiles where id = auth.uid() and active
$$;
create function my_customer() returns uuid language sql stable security definer set search_path = public as $$
 select customer_id from profiles where id = auth.uid() and active
$$;
create function is_staff() returns boolean language sql stable as $$ select coalesce(my_role() in ('admin','advisor'), false) $$;
create function can_read_job(p_job uuid) returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from jobs j join profiles p on p.id=auth.uid() and p.active
  where j.id=p_job and (p.role in ('admin','advisor') or (p.role='technician' and j.technician_id=p.id) or (p.role='customer' and j.customer_id=p.customer_id)))
$$;

-- Mutations are exclusively handled by the validated Node API within a SQL transaction.
-- The public Supabase key cannot bypass those business rules.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter table settings enable row level security;
grant select on settings to authenticated;
alter table resources enable row level security;
grant select on resources to authenticated;
alter table catalog_items enable row level security;
grant select on catalog_items to authenticated;
alter table service_types enable row level security;
grant select on service_types to authenticated;
alter table service_type_items enable row level security;
grant select on service_type_items to authenticated;
alter table customers enable row level security;
grant select on customers to authenticated;
alter table profiles enable row level security;
grant select on profiles to authenticated;
alter table vehicles enable row level security;
grant select on vehicles to authenticated;
alter table appointments enable row level security;
grant select on appointments to authenticated;
alter table jobs enable row level security;
grant select on jobs to authenticated;
alter table job_status_events enable row level security;
grant select on job_status_events to authenticated;
alter table inspections enable row level security;
grant select on inspections to authenticated;
alter table estimates enable row level security;
grant select on estimates to authenticated;
alter table estimate_lines enable row level security;
grant select on estimate_lines to authenticated;
alter table payments enable row level security;
grant select on payments to authenticated;
alter table customer_notes enable row level security;
grant select on customer_notes to authenticated;
alter table customer_note_revisions enable row level security;
grant select on customer_note_revisions to authenticated;
alter table visit_evaluations enable row level security;
grant select on visit_evaluations to authenticated;
alter table reminder_logs enable row level security;
grant select on reminder_logs to authenticated;
alter table audit_log enable row level security;
grant select on audit_log to authenticated;
alter table app_control enable row level security;
grant select on app_control to authenticated;
alter table operation_keys enable row level security;
grant select on operation_keys to authenticated;

create policy company_read on settings for select to authenticated using (my_role() is not null);
create policy resources_read on resources for select to authenticated using (my_role() is not null);
create policy services_read on service_types for select to authenticated using (my_role() is not null);
create policy service_items_read on service_type_items for select to authenticated using (my_role() is not null);
create policy catalog_staff on catalog_items for select to authenticated using (is_staff());
create policy profile_read on profiles for select to authenticated using (is_staff() or id=auth.uid());
create policy customers_read on customers for select to authenticated using (is_staff() or id=my_customer() or (my_role()='technician' and exists(select 1 from jobs j where j.customer_id=customers.id and j.technician_id=auth.uid())));
create policy vehicles_read on vehicles for select to authenticated using (is_staff() or customer_id=my_customer() or (my_role()='technician' and exists(select 1 from jobs j where j.vehicle_id=vehicles.id and j.technician_id=auth.uid())));
create policy appointments_read on appointments for select to authenticated using (is_staff() or customer_id=my_customer());
create policy jobs_read on jobs for select to authenticated using (can_read_job(id));
create policy history_staff on job_status_events for select to authenticated using (is_staff() or (my_role()='technician' and can_read_job(job_id)));
create policy inspections_read on inspections for select to authenticated using (can_read_job(job_id) and (my_role()<>'customer' or customer_visible));
create policy estimates_read on estimates for select to authenticated using (can_read_job(job_id) and (my_role()<>'customer' or status<>'Taslak'));
create policy lines_read on estimate_lines for select to authenticated using (exists(select 1 from estimates e where e.id=estimate_id));
create policy payments_staff on payments for select to authenticated using (is_staff());
create policy notes_staff on customer_notes for select to authenticated using (is_staff());
create policy revisions_staff on customer_note_revisions for select to authenticated using (is_staff());
create policy evaluations_staff on visit_evaluations for select to authenticated using (is_staff());
create policy reminders_staff on reminder_logs for select to authenticated using (is_staff());
create policy audit_admin on audit_log for select to authenticated using (my_role()='admin');
-- app_control and operation_keys have no authenticated policy.

revoke all on function my_role(), my_customer(), is_staff(), can_read_job(uuid), forbid_locked_lines() from public;
grant execute on function my_role(), my_customer(), is_staff(), can_read_job(uuid) to authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Photos are private. Paths are job UUID / inspection UUID / random filename.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('service-photos','service-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do nothing;
create policy service_photo_read on storage.objects for select to authenticated using (
 bucket_id='service-photos' and exists(select 1 from inspections i where i.photo_path=name and can_read_job(i.job_id) and (my_role()<>'customer' or i.customer_visible))
);
-- Uploads go through the Node API, which verifies actual bytes, size, and assigned job.

-- Stable ordering preserves manual quote line order and the UI creation order.
alter table settings add column position integer not null default 0;
alter table resources add column position integer not null default 0;
alter table catalog_items add column position integer not null default 0;
alter table service_types add column position integer not null default 0;
alter table service_type_items add column position integer not null default 0;
alter table customers add column position integer not null default 0;
alter table profiles add column position integer not null default 0;
alter table vehicles add column position integer not null default 0;
alter table appointments add column position integer not null default 0;
alter table jobs add column position integer not null default 0;
alter table job_status_events add column position integer not null default 0;
alter table inspections add column position integer not null default 0;
alter table estimates add column position integer not null default 0;
alter table estimate_lines add column position integer not null default 0;
alter table payments add column position integer not null default 0;
alter table customer_notes add column position integer not null default 0;
alter table customer_note_revisions add column position integer not null default 0;
alter table visit_evaluations add column position integer not null default 0;
alter table reminder_logs add column position integer not null default 0;
alter table audit_log add column position integer not null default 0;
alter table vehicles add constraint vehicles_owner_key unique(id,customer_id);
alter table appointments add constraint appointment_owner foreign key(vehicle_id,customer_id) references vehicles(id,customer_id);
alter table jobs add constraint job_owner foreign key(vehicle_id,customer_id) references vehicles(id,customer_id);
