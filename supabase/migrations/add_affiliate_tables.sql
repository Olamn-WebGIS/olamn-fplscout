-- 1. Create the tables first
create table if not exists referrals (
  id uuid default uuid_generate_v4() primary key,
  affiliate_id uuid not null references users(id) on delete cascade,
  referred_user_id uuid not null references users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  commission_paid boolean default false,
  commission_paid_at timestamp with time zone
);

create table if not exists affiliate_earnings (
  id uuid default uuid_generate_v4() primary key,
  affiliate_id uuid not null references users(id) on delete cascade,
  referred_user_id uuid not null references users(id) on delete cascade,
  referral_id uuid references referrals(id) on delete set null,
  amount_ngn integer not null default 2000,
  description text,
  earned_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists withdrawal_requests (
  id uuid default uuid_generate_v4() primary key,
  affiliate_id uuid not null references users(id) on delete cascade,
  amount_ngn integer not null,
  status text not null default 'pending',
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  requested_at timestamp with time zone default timezone('utc'::text, now()),
  completed_at timestamp with time zone,
  notes text
);

-- 2. Then set the security (No 'if not exists' here)
alter table referrals enable row level security;
create policy "referrals_select_owner" on referrals for select using (affiliate_id = auth.uid() or referred_user_id = auth.uid());
create policy "referrals_insert_affiliate" on referrals for insert with check (affiliate_id = auth.uid());

alter table affiliate_earnings enable row level security;
create policy "affiliate_earnings_select_owner" on affiliate_earnings for select using (affiliate_id = auth.uid());
create policy "affiliate_earnings_insert_owner" on affiliate_earnings for insert with check (affiliate_id = auth.uid());

alter table withdrawal_requests enable row level security;
create policy "withdrawal_requests_select_owner" on withdrawal_requests for select using (affiliate_id = auth.uid());
create policy "withdrawal_requests_insert_owner" on withdrawal_requests for insert with check (affiliate_id = auth.uid());
create policy "withdrawal_requests_update_paid" on withdrawal_requests for update using (affiliate_id = auth.uid()) with check (affiliate_id = auth.uid());