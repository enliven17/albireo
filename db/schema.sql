-- Albireo schema. Idempotent: safe to run on every deploy.

create table if not exists tenants (
  id          text primary key,
  name        text not null,
  category    text,
  scf_round   int,
  status      text not null default 'active' check (status in ('active', 'suspended', 'removed')),
  public_card boolean not null default false,
  created_at  timestamptz not null default now()
);

-- a tenant may own several verified domains; events are accepted only from these
create table if not exists domains (
  tenant_id       text not null references tenants(id) on delete cascade,
  domain          text not null,
  method          text check (method in ('sep1', 'dns', 'meta')),
  token           text not null,
  verified_at     timestamptz,
  last_checked_at timestamptz,
  primary key (tenant_id, domain)
);

create table if not exists sites (
  id        text primary key,          -- public id used in the script tag
  tenant_id text not null references tenants(id) on delete cascade
);

create table if not exists api_keys (
  id           text primary key,
  tenant_id    text references tenants(id) on delete cascade, -- null for operator keys
  hash         text not null unique,   -- sha256 of the secret, the secret itself is never stored
  scopes       text[] not null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

-- web events: no IP, no cookie, no wallet address; visitor is a daily salted hash
create table if not exists events (
  site_id    text not null,
  ts         timestamptz not null,
  type       text not null check (type in ('pageview', 'event')),
  name       text,
  path       text not null,
  referrer   text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  country    text,
  browser    text,
  os         text,
  device     text,
  visitor    text not null,
  props      jsonb
);
create index if not exists events_site_ts on events (site_id, ts);

-- filtered traffic, counted in the open
create table if not exists drops (
  site_id text not null,
  day     date not null,
  reason  text not null,
  count   bigint not null default 0,
  primary key (site_id, day, reason)
);

-- API metrics per minute: counters and an explicit bucket histogram, nothing else
create table if not exists api_minute (
  tenant_id    text not null,
  service      text not null,
  route        text not null,
  status_class text not null,
  minute       timestamptz not null,
  count        bigint not null,
  sum_ms       double precision not null,
  buckets      bigint[] not null,
  primary key (tenant_id, service, route, status_class, minute)
);

create table if not exists seals (
  day        date primary key,
  root       text not null,
  leaves     int not null,
  tx_hash    text,
  created_at timestamptz not null default now()
);

create table if not exists seal_leaves (
  day       date not null references seals(day) on delete cascade,
  tenant_id text not null,
  leaf      text not null,
  summary   text not null,             -- canonical JSON exactly as hashed
  primary key (day, tenant_id)
);

create table if not exists audit_log (
  at     timestamptz not null default now(),
  actor  text not null,
  action text not null,
  target text not null,
  detail jsonb
);

-- one random salt per UTC day for visitor hashes; old days are deleted so visits cannot be linked
create table if not exists salts (
  day  date primary key,
  salt bytea not null
);
