create table if not exists careers_applications (
  id uuid primary key,
  name text not null,
  email text not null,
  phone text not null,
  has_experience text not null,
  accepted_terms boolean not null default false,
  video_name text,
  video_url text,
  storage_path text,
  status text not null default 'Pending',
  submitted_at timestamptz not null default now(),
  status_updated_at timestamptz,
  access_token text
);

create index if not exists careers_applications_email_idx on careers_applications (email);
create index if not exists careers_applications_status_idx on careers_applications (status);
