-- 쉐어마켓 스키마 (Supabase SQL Editor에서 실행)
create type request_status as enum ('waiting','matched','picked_up','cancelled');
create type group_status   as enum ('confirmed','picked_up','cancelled');

create table regions (id uuid primary key default gen_random_uuid(), name text not null unique); -- 대학/지역 단위

create table users (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null,
  region_id uuid references regions(id),
  lat double precision, lng double precision,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_amount numeric not null,      -- 총량 (30, 1000 ...)
  unit text not null,                 -- 구, g, 개 ...
  split_amount numeric not null,      -- 소분 단위 (10구, 250g ...)
  total_price int not null,           -- 총가격(원)
  image_url text,
  active boolean not null default true,
  created_at timestamptz default now(),
  check (total_amount % split_amount = 0)
);

create table pickup_points (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references regions(id),
  name text not null, lat double precision, lng double precision
);

create table requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  product_id uuid not null references products(id),
  region_id uuid not null references regions(id),
  qty int not null check (qty > 0),   -- 소분 단위 개수
  deadline timestamptz not null,
  status request_status not null default 'waiting',
  created_at timestamptz default now()
);
create index on requests (product_id, region_id, status, deadline);

create table groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  region_id uuid not null references regions(id),
  pickup_point_id uuid references pickup_points(id),
  pickup_at timestamptz,
  status group_status not null default 'confirmed',
  created_at timestamptz default now()
);

create table group_members (
  group_id uuid references groups(id) on delete cascade,
  request_id uuid unique references requests(id),
  user_id uuid not null references users(id),
  qty int not null, amount int not null, -- 개별 결제 금액
  primary key (group_id, request_id)
);

-- RLS (매칭/관리자 작업은 서버에서 service_role 키로 수행)
alter table users enable row level security;
alter table requests enable row level security;
alter table group_members enable row level security;
alter table groups enable row level security;
alter table products enable row level security;
alter table pickup_points enable row level security;
alter table regions enable row level security;
create policy "read all" on products for select using (true);
create policy "read all" on regions for select using (true);
create policy "read all" on pickup_points for select using (true);
create policy "own profile" on users for all using (auth.uid() = id);
create policy "own requests" on requests for all using (auth.uid() = user_id);
create policy "own memberships" on group_members for select using (auth.uid() = user_id);
create policy "my groups" on groups for select using (
  exists (select 1 from group_members m where m.group_id = groups.id and m.user_id = auth.uid()));
