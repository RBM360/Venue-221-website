-- Allow "unavailable" in bookings status columns
alter table if exists public.bookings
  drop constraint if exists bookings_full_day_check,
  drop constraint if exists bookings_half_morning_check,
  drop constraint if exists bookings_half_evening_check;

alter table if exists public.bookings
  add constraint bookings_full_day_check
    check (full_day is null or full_day in ('available','tentative','booked','unavailable')),
  add constraint bookings_half_morning_check
    check (half_morning is null or half_morning in ('available','tentative','booked','unavailable')),
  add constraint bookings_half_evening_check
    check (half_evening is null or half_evening in ('available','tentative','booked','unavailable'));
