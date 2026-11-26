create table customer_access_deliveries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers,
  user_id uuid not null references profiles,
  email text not null,
  status text not null check (status in ('pending','sent','failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  requested_by uuid not null references profiles
);
create index customer_access_delivery_customer on customer_access_deliveries(customer_id, created_at desc);
alter table customer_access_deliveries enable row level security;
revoke all on customer_access_deliveries from anon, authenticated;
grant all on customer_access_deliveries to service_role;
