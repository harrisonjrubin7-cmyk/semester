#!/usr/bin/env bash

# Reproducible, temporary developer-tool checks. Neither binary is an app
# dependency and neither is shipped to students. Versions and release hashes
# are pinned so a moved tag or changed download cannot silently alter CI.

set -euo pipefail

readonly ACTIONLINT_VERSION='1.7.12'
readonly OSV_SCANNER_VERSION='2.6.0'

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)
    readonly ACTIONLINT_TARGET='darwin_arm64'
    readonly ACTIONLINT_SHA256='aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f'
    readonly OSV_TARGET='darwin_arm64'
    readonly OSV_SHA256='98c460dcd37de25819babd757d04542045b6243113e209edcd4d89fedb0256b4'
    ;;
  Linux-x86_64)
    readonly ACTIONLINT_TARGET='linux_amd64'
    readonly ACTIONLINT_SHA256='8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8'
    readonly OSV_TARGET='linux_amd64'
    readonly OSV_SHA256='ca69b3d3cd08f889a49dc0a383122f71cc528b83803671df5fd874d97485b108'
    ;;
  *)
    echo "Unsupported developer-tool platform: $(uname -s)/$(uname -m)" >&2
    exit 2
    ;;
esac

readonly TOOL_DIR="$(mktemp -d /tmp/semester-developer-tools.XXXXXX)"

cleanup() {
  case "$TOOL_DIR" in
    /tmp/semester-developer-tools.*) rm -rf -- "$TOOL_DIR" ;;
    *) echo "Refusing to clean unexpected tool directory: $TOOL_DIR" >&2 ;;
  esac
}
trap cleanup EXIT

download() {
  local url="$1"
  local output="$2"
  curl --fail --silent --show-error --location \
    --proto '=https' --tlsv1.2 \
    "$url" --output "$output"
}

verify_sha256() {
  local expected="$1"
  local file="$2"
  local actual

  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$file" | awk '{print $1}')"
  else
    actual="$(shasum -a 256 "$file" | awk '{print $1}')"
  fi

  if [[ "$actual" != "$expected" ]]; then
    echo "SHA-256 mismatch for $file" >&2
    exit 1
  fi
}

readonly ACTIONLINT_ARCHIVE="$TOOL_DIR/actionlint.tar.gz"
readonly ACTIONLINT_URL="https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_${ACTIONLINT_TARGET}.tar.gz"

download "$ACTIONLINT_URL" "$ACTIONLINT_ARCHIVE"
verify_sha256 "$ACTIONLINT_SHA256" "$ACTIONLINT_ARCHIVE"
tar -xzf "$ACTIONLINT_ARCHIVE" -C "$TOOL_DIR" actionlint

echo "actionlint v${ACTIONLINT_VERSION}: checking GitHub Actions workflows"
"$TOOL_DIR/actionlint" -color .github/workflows/*.yml

readonly OSV_SCANNER="$TOOL_DIR/osv-scanner"
readonly OSV_URL="https://github.com/google/osv-scanner/releases/download/v${OSV_SCANNER_VERSION}/osv-scanner_${OSV_TARGET}"

download "$OSV_URL" "$OSV_SCANNER"
verify_sha256 "$OSV_SHA256" "$OSV_SCANNER"
chmod 700 "$OSV_SCANNER"

echo "OSV-Scanner v${OSV_SCANNER_VERSION}: checking every supported lockfile"
"$OSV_SCANNER" scan source --recursive .
