-- Replace JSONB timestamp array rate limiting with fixed-window counters.
-- Old table kept for rollback; new table is used by consumeRateLimit going forward.

create table if not exists rate_limit_counters (
  bucket text not null,
  window_start bigint not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);
