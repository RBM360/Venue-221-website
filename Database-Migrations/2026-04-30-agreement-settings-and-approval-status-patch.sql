begin;

create table if not exists public.agreement_settings (
  id bigint primary key,
  notify_email text not null,
  venue_signer_email text,
  updated_at timestamptz not null default now()
);

alter table public.agreement_settings enable row level security;

drop policy if exists agreement_settings_authenticated_rw on public.agreement_settings;
create policy agreement_settings_authenticated_rw
on public.agreement_settings
for all
to authenticated
using (true)
with check (true);

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.booking_agreements'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%agreement_status%'
  loop
    execute format('alter table public.booking_agreements drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.booking_agreements
  add constraint booking_agreements_agreement_status_check
  check (
    agreement_status in (
      'pending_signature',
      'sent',
      'viewed',
      'awaiting_manager_approval',
      'approved',
      'completed',
      'declined',
      'expired',
      'voided',
      'canceled'
    )
  );

commit;
