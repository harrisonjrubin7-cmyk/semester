-- An identity provider's attribute mapping may name only the claims Semester
-- accepts, and never a source attribute that reads as a FERPA-protected record.
--
-- `institution_identity_provider.attribute_mapping` arrived as free jsonb with
-- nothing reading it and nothing constraining it: a mapping of a campus `gpa`
-- or `disabilityStatus` attribute would have been stored. The rule is written
-- twice — here, and in packages/institution/src/identity.ts — and
-- identity.test.ts reads this file to hold the two lists equal.
--
-- The claim allowlist is the guard. The fragment list catches honest mistakes
-- by name and cannot see a prohibited attribute sent under an opaque OID; that
-- one still lands only in an allowed claim, and a person reviews mappings
-- before a provider is authorized.

create or replace function private.identity_attribute_mapping_allowed(mapping jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(mapping) = 'object'
     and not exists (
       select 1
         from jsonb_each(mapping) entry(claim, attribute)
        where entry.claim <> all (array[
                'subject', 'email', 'display_name', 'given_name', 'family_name',
                'affiliation', 'groups', 'campus', 'department'
              ]::text[])
           or jsonb_typeof(entry.attribute) <> 'string'
           or length(trim(entry.attribute #>> '{}')) not between 1 and 300
           or exists (
             select 1
               from unnest(array[
                 'gpa', 'grade', 'transcript', 'financialaid', 'fafsa',
                 'health', 'medical', 'disability', 'accommodation', 'counsel',
                 'conduct', 'disciplin', 'immigration', 'visa', 'citizenship',
                 'ssn', 'socialsecurity', 'dateofbirth', 'birthdate',
                 'roster', 'enrollment', 'submission', 'attendance',
                 'geolocation', 'locationhistory', 'privatemessage'
               ]::text[]) fragment
              where position(fragment in regexp_replace(lower(entry.attribute #>> '{}'), '[^a-z0-9]', '', 'g')) > 0
           )
     )
$$;

revoke all on function private.identity_attribute_mapping_allowed(jsonb) from public, anon, authenticated;
-- A check constraint runs with the writer's privileges; the service role is
-- the only writer of provider rows.
grant execute on function private.identity_attribute_mapping_allowed(jsonb) to service_role;

alter table public.institution_identity_provider
  drop constraint if exists identity_provider_attribute_mapping_minimal;
alter table public.institution_identity_provider
  add constraint identity_provider_attribute_mapping_minimal
  check (private.identity_attribute_mapping_allowed(attribute_mapping));

comment on column public.institution_identity_provider.attribute_mapping is
  'Semester claim -> IdP attribute name. Only the claims in private.identity_attribute_mapping_allowed; never a FERPA-protected record. Mapping a claim grants no role.';
