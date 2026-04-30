begin;

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.agreement_template_fields'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%field_type%'
  loop
    execute format('alter table public.agreement_template_fields drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.agreement_template_fields
  add constraint agreement_template_fields_field_type_check
  check (field_type in ('text', 'email', 'phone', 'date', 'signature', 'initial', 'number', 'name', 'checkbox', 'dropdown'));

commit;
