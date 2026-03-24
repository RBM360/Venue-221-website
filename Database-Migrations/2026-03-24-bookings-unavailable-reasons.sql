-- Manager-only unavailable reasons for core booking blocks
alter table if exists public.bookings
  add column if not exists full_day_reason text,
  add column if not exists half_morning_reason text,
  add column if not exists half_evening_reason text;
