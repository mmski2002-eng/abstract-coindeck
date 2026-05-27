create table if not exists oracle_history (
  epoch integer not null,
  day integer not null,
  scores jsonb not null,
  source text not null default 'chain',
  ledger_version text,
  updated_at timestamptz not null default now(),
  primary key (epoch, day)
);

-- migration: add source/ledger_version if upgrading from older schema
alter table oracle_history add column if not exists source text not null default 'chain';
alter table oracle_history add column if not exists ledger_version text;

create table if not exists sync_meta (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists leaderboard_day_lineups (
  epoch integer not null,
  day integer not null,
  complete boolean not null default false,
  entries jsonb not null,
  updated_at bigint not null,
  primary key (epoch, day)
);

create table if not exists oracle_scores_cache (
  epoch integer not null,
  day integer not null,
  payload jsonb not null,
  updated_at bigint not null,
  primary key (epoch, day)
);

create table if not exists leaderboard_cache (
  cache_id text primary key,
  epoch integer not null,
  total_days integer not null,
  current_day integer not null,
  role_bonus_pct integer not null,
  payload jsonb not null,
  updated_at bigint not null
);

create index if not exists leaderboard_cache_lookup_idx
  on leaderboard_cache (epoch, total_days, current_day, role_bonus_pct, updated_at desc);

create table if not exists leaderboard_rows (
  cache_id text not null,
  rank integer not null,
  addr text not null,
  score numeric not null,
  league integer not null,
  days integer not null,
  nickname text,
  prev_day_tiers integer[],
  prev_day_pids integer[],
  primary key (cache_id, rank)
);

create index if not exists leaderboard_rows_addr_idx on leaderboard_rows (cache_id, addr);
create index if not exists leaderboard_rows_league_idx on leaderboard_rows (cache_id, league, rank);

create table if not exists lineup_pick_counts (
  epoch integer not null,
  day integer not null,
  pid integer not null,
  picks integer not null,
  primary key (epoch, day, pid)
);

create table if not exists app_config (
  namespace text not null,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (namespace, key)
);

create table if not exists feedback (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  ip_hash text not null,
  rating integer null,
  name text null,
  wallet text null,
  text text not null
);

create table if not exists rate_limits (
  bucket text primary key,
  hits jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists rate_limit_counters (
  bucket text not null,
  window_start bigint not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);

create table if not exists admin_nonces (
  nonce text primary key,
  action text not null,
  domain text not null,
  issued_at bigint not null,
  expires_at bigint not null,
  used_at bigint null
);

create index if not exists admin_nonces_lookup_idx
  on admin_nonces (action, domain, expires_at);

create table if not exists market_data_cache (
  cache_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists job_state (
  job_key text primary key,
  job_type text not null,
  state text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists job_state_type_idx
  on job_state (job_type, updated_at desc);

create table if not exists audit_log (
  id bigserial primary key,
  scope text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists bot_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists bot_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists marketplace_listings (
  listing_id bigint primary key,
  seller text not null,
  card_addr text not null,
  player_id integer not null,
  tier integer not null,
  price bigint not null,
  updated_at bigint not null
);

create index if not exists marketplace_listings_player_tier_idx on marketplace_listings (player_id, tier);
create index if not exists marketplace_listings_seller_idx on marketplace_listings (seller);

create table if not exists market_snapshot (
  epoch integer not null,
  day integer not null,
  coin_data jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (epoch, day)
);
