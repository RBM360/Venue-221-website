begin;

drop policy if exists agreement_settings_anon_read on public.agreement_settings;
create policy agreement_settings_anon_read
on public.agreement_settings
for select
to anon
using (id = 1);

commit;
