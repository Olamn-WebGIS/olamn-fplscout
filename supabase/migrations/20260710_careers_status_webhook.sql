create or replace function notify_careers_status_change()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    perform net.http_post(
      url := 'https://fplscout.name.ng/api/webhooks/careers-status',
      body := jsonb_build_object(
        'applicant', jsonb_build_object(
          'id', new.id,
          'name', new.name,
          'email', new.email,
          'status', new.status,
          'access_token', new.access_token
        )
      )::text,
      headers := jsonb_build_object(
        'content-type', 'application/json'
      ),
      timeout_milliseconds := 10000
    );

    perform net.http_post(
      url := 'https://fplscout.name.ng/api/webhooks/careers-status',
      body := jsonb_build_object(
        'applicant', jsonb_build_object(
          'id', new.id,
          'name', new.name,
          'email', new.email,
          'status', new.status,
          'access_token', new.access_token
        ),
        'fallback', true
      )::text,
      headers := jsonb_build_object(
        'content-type', 'application/json'
      ),
      timeout_milliseconds := 10000
    );
  end if;

  return new;
end;
$$;

create trigger careers_status_change_notify
after update of status on careers_applications
for each row
execute function notify_careers_status_change();
