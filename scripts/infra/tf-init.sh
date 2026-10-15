#!/usr/bin/env bash
# Initialise a Terraform root against the remote state, from environment only.
#
#   STATE_BUCKET=… STATE_REGION=… [STATE_ENDPOINT=…] scripts/infra/tf-init.sh <root>
#
# The bucket, region and endpoint are variables of the GitHub environment, not
# files in git, so no account identifier is committed and the same code
# initialises against AWS S3 or any store that speaks the S3 protocol.
#
# Credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) are the state store's
# own, scoped to that bucket and nothing else.
set -euo pipefail

root="${1:?terraform root: platform | staging | production}"
: "${STATE_BUCKET:?}" "${STATE_REGION:?}"

cd "$(dirname "$0")/../../infra/terraform/envs/${root}"

args=(
  -input=false
  -lockfile=readonly
  "-backend-config=bucket=${STATE_BUCKET}"
  "-backend-config=key=${root}/terraform.tfstate"
  "-backend-config=region=${STATE_REGION}"
  "-backend-config=encrypt=true"
  # Native S3 locking (Terraform >= 1.10): no separate lock table to provision,
  # and therefore none to forget.
  "-backend-config=use_lockfile=true"
)
if [ -n "${STATE_ENDPOINT:-}" ]; then
  args+=("-backend-config=endpoints={s3=\"${STATE_ENDPOINT}\"}" -backend-config=skip_credentials_validation=true -backend-config=skip_requesting_account_id=true -backend-config=skip_metadata_api_check=true -backend-config=skip_region_validation=true -backend-config=use_path_style=true)
fi

terraform init "${args[@]}"
