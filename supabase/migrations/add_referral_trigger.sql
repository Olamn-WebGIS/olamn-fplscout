create or replace function process_referral_reward()
returns trigger
language plpgsql
as $$
declare
  v_affiliate_user_id uuid;
  v_referral_id uuid;
begin
  if new.ref_code is null or new.ref_code = '' then
    return new;
  end if;

  select a.user_id
  into v_affiliate_user_id
  from public.affiliates a
  where a.ref_code = new.ref_code
  limit 1;

  if v_affiliate_user_id is null then
    return new;
  end if;

  insert into public.referrals (
    affiliate_id,
    referred_user_id,
    created_at,
    commission_paid,
    commission_paid_at
  )
  values (
    v_affiliate_user_id,
    new.id,
    timezone('utc'::text, now()),
    false,
    null
  )
  returning id into v_referral_id;

  insert into public.affiliate_earnings (
    affiliate_id,
    referred_user_id,
    referral_id,
    amount_ngn,
    description,
    earned_at
  )
  values (
    v_affiliate_user_id,
    new.id,
    v_referral_id,
    2000,
    'Referral reward for signup',
    timezone('utc'::text, now())
  );

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
