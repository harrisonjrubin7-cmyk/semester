# Production adopts the existing project; its reference is already public in
# the repository (SETUP.md) and is an identifier, not a credential.
supabase_project_ref = "lzrqvlugnawcgywkhqlz"

# Direct Postgres access is restricted to the CI runner egress ranges and the
# maintainer's admin addresses. Fill in via the change record that applies
# this root; an empty list fails the plan (module precondition + policy).
db_allowed_cidrs = []

# Vercel project that serves app/api/institution. Identifier, not a secret.
vercel_project_id = "REPLACE-IN-CHANGE-RECORD"
