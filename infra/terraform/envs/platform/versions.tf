terraform {
  required_version = ">= 1.10.0, < 2.0.0"

  # Partial configuration: the bucket, key and lock table are supplied by
  # `-backend-config` from the workflow, so no account identifier is committed
  # and the same code initialises against any state store that speaks the S3
  # protocol. State is encrypted, versioned and locked — see
  # `docs/infrastructure/DISASTER-RECOVERY.md` for the requirements the store
  # must meet and why they are requirements rather than preferences.
  backend "s3" {}
}
