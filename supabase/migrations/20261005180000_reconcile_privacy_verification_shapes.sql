-- Two verification contracts share data_subject_request, and both stay.
--
-- The console path (20261005123000) records an account id, a basis and an
-- evidence reference together, or it records nothing. The platform-scope path
-- (20261004200000, D-1258) records a rung and a SHA-256 pseudonym and
-- deliberately does not store an account id. The earlier check allowed only
-- the first shape, so verify_data_subject_request could not write.

alter table public.data_subject_request
  drop constraint if exists data_subject_request_verification_complete;

alter table public.data_subject_request
  add constraint data_subject_request_verification_complete
  check (
    (
      verified_at is null
      and verified_by is null
      and verification_basis is null
      and verification_evidence is null
      and verified_rung is null
      and verified_by_sha256 is null
    )
    or
    (
      verified_at is not null
      and verified_by is not null
      and verification_basis is not null
      and verification_evidence is not null
    )
    or
    (
      verified_at is not null
      and verified_by is null
      and verification_basis is null
      and verification_evidence is null
      and verified_rung is not null
      and verified_by_sha256 is not null
    )
  );
