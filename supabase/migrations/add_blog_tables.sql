-- Create blog posts table
create table if not exists posts (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  slug text not null unique,
  summary text not null,
  content text not null,
  author text default 'FPL Scout',
  published_at timestamp with time zone default timezone('utc'::text, now()),
  likes integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Create newsletter subscribers table
create table if not exists newsletter_subscribers (
  id uuid default uuid_generate_v4() primary key,
  email text not null unique,
  is_subscribed boolean default true,
  subscribed_at timestamp with time zone default timezone('utc'::text, now())
);
