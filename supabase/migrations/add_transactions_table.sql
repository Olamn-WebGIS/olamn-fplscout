-- Create the transactions ledger table for revenue and payout tracking
create table if not exists transactions (
  id uuid default uuid_generate_v4() primary key,
  type text not null check (type in ('subscription', 'affiliate_payout')),
  amount integer not null,
  user_id uuid references users(id) on delete set null,
  status text not null default 'completed',
  payment_reference text unique,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table transactions enable row level security;
create policy "transactions_select_admin" on transactions for select using (true);
create policy "transactions_insert_admin" on transactions for insert with check (true);
create policy "transactions_update_admin" on transactions for update using (true) with check (true);
create policy "transactions_delete_admin" on transactions for delete using (true);
