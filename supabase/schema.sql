-- ATHAR (أثر) — Supabase schema
-- Mirrors the local mock in src/lib/store.tsx. Run in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ───────── Products ─────────
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  name_ar text,
  category text not null check (category in ('posters','sleeves','flags','cases','sunshades','umbrellas')),
  price numeric(10,2) not null check (price >= 0),
  compare_at numeric(10,2),
  stock int not null default 0,
  active boolean not null default true,
  featured boolean not null default false,
  description text,
  details text[] default '{}',
  variant_label text,
  variants jsonb not null default '[]',      -- [{id,label,priceDelta}]
  custom_text text,                           -- personalisation field label
  images text[] default '{}',                 -- public URLs in the product-images bucket
  created_at timestamptz not null default now()
);

-- ───────── Admins (linked to Supabase Auth users) ─────────
create table if not exists admins (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  role text not null default 'staff' check (role in ('owner','admin','staff')),
  created_at timestamptz not null default now(),
  last_login timestamptz
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from admins where id = auth.uid()) $$;

-- ───────── Orders ─────────
create sequence if not exists order_seq start 1101;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  number text unique not null default ('ATH-' || nextval('order_seq')),
  created_at timestamptz not null default now(),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  governorate text not null,
  city text not null,
  address text not null,
  notes text,
  subtotal numeric(10,2) not null,
  shipping_fee numeric(10,2) not null,
  total numeric(10,2) not null,
  pay_method text not null check (pay_method in ('instapay','wallet','bank')),
  pay_reference text,
  sender_name text,
  receipt_path text not null,                 -- path in the private receipts bucket
  payment_verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending','confirmed','shipped','delivered','cancelled'))
);

create table if not exists order_lines (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null,
  variant text,
  custom text,
  unit_price numeric(10,2) not null,
  qty int not null check (qty > 0)
);

create table if not exists order_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  status text not null,
  at timestamptz not null default now(),
  by_admin uuid references admins(id),
  note text
);

-- ───────── Store settings (single row) ─────────
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null
);

-- ───────── Row Level Security ─────────
alter table products enable row level security;
alter table admins enable row level security;
alter table orders enable row level security;
alter table order_lines enable row level security;
alter table order_history enable row level security;
alter table settings enable row level security;

create policy "public reads active products" on products for select using (active or is_admin());
create policy "admins manage products" on products for all using (is_admin()) with check (is_admin());

create policy "admins read admins" on admins for select using (is_admin());
create policy "owners manage admins" on admins for all
  using (exists (select 1 from admins where id = auth.uid() and role = 'owner'))
  with check (exists (select 1 from admins where id = auth.uid() and role = 'owner'));

-- customers can create orders but never read other people's orders
create policy "anyone places orders" on orders for insert with check (status = 'pending' and payment_verified = false);
create policy "admins manage orders" on orders for all using (is_admin()) with check (is_admin());
create policy "anyone adds lines" on order_lines for insert with check (true);
create policy "admins read lines" on order_lines for select using (is_admin());
create policy "admins manage history" on order_history for all using (is_admin()) with check (is_admin());

create policy "public reads settings" on settings for select using (true);
create policy "admins edit settings" on settings for update using (is_admin());

-- Order tracking for customers: number + phone must both match
create or replace function track_order(p_number text, p_phone text)
returns table (number text, status text, created_at timestamptz, total numeric)
language sql security definer set search_path = public as $$
  select number, status, created_at, total from orders
  where number = upper(p_number) and customer_phone = p_phone
$$;

-- ───────── Storage ─────────
-- Bucket "product-images": public.   Bucket "receipts": PRIVATE.
insert into storage.buckets (id, name, public) values ('product-images','product-images', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('receipts','receipts', false) on conflict do nothing;

create policy "anyone uploads receipts" on storage.objects for insert
  with check (bucket_id = 'receipts');
create policy "admins view receipts" on storage.objects for select
  using (bucket_id = 'receipts' and is_admin());
create policy "admins manage product images" on storage.objects for all
  using (bucket_id = 'product-images' and is_admin()) with check (bucket_id = 'product-images' and is_admin());

-- ───────── New-order notifications ─────────
-- Enable Realtime on `orders` (Database → Replication) so the admin dashboard gets
-- an instant toast. For email/WhatsApp alerts, add a Database Webhook on INSERT into
-- `orders` pointing to an Edge Function that calls your mail or WhatsApp provider.
alter publication supabase_realtime add table orders;
