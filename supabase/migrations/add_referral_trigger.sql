create or replace function process_referral_reward()
returns trigger
language plpgsql
as $$
begin
  if new.ref_code is null or new.ref_code = '' then
    return new;
  end if;

  insert into public.referrals (
    affiliate_id,
    referred_user_id,
    created_at,
    commission_paid,
    commission_paid_at
  )
  select
    a.id,
    new.id,
    timezone('utc'::text, now()),
    false,
    null
  from public.affiliates a
  where a.ref_code = new.ref_code
  limit 1;

  if not found then
    return new;
  end if;

  insert into public.transactions (
    type,
    amount,
    user_id,
    status,
    payment_reference,
    note,
    created_at
  )
  values (
    'referral_reward',
    2000,
    new.id,
    'completed',
    concat('ref-', new.id),
    'Referral reward for signup',
    timezone('utc'::text, now())
  );

  return new;
end;
$$;

drop trigger if exists trigger_process_referral_reward on public.users;

create trigger trigger_process_referral_reward
after insert on public.users
for each row
execute function public.process_referral_reward();
