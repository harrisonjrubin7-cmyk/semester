#!/usr/bin/env bash

# Reproducible, temporary developer-tool checks. None is an app dependency and
# none is shipped to students. Versions and release hashes
# are pinned so a moved tag or changed download cannot silently alter CI.

set -euo pipefail

readonly ACTIONLINT_VERSION='1.7.12'
readonly OSV_SCANNER_VERSION='2.6.0'
readonly SHELLCHECK_VERSION='0.11.0'

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)
    readonly ACTIONLINT_TARGET='darwin_arm64'
    readonly ACTIONLINT_SHA256='aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f'
    readonly OSV_TARGET='darwin_arm64'
    readonly OSV_SHA256='98c460dcd37de25819babd757d04542045b6243113e209edcd4d89fedb0256b4'
    readonly SHELLCHECK_TARGET='darwin.aarch64'
    readonly SHELLCHECK_SHA256='339b930feb1ea764467013cc1f72d09cd6b869ebf1013296ba9055ab2ffbd26f'
    ;;
  Linux-x86_64)
    readonly ACTIONLINT_TARGET='linux_amd64'
    readonly ACTIONLINT_SHA256='8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8'
    readonly OSV_TARGET='linux_amd64'
    readonly OSV_SHA256='ca69b3d3cd08f889a49dc0a383122f71cc528b83803671df5fd874d97485b108'
    readonly SHELLCHECK_TARGET='linux.x86_64'
    readonly SHELLCHECK_SHA256='b7af85e41cc99489dcc21d66c6d5f3685138f06d34651e6d34b42ec6d54fe6f6'
    ;;
  *)
    echo "Unsupported developer-tool platform: $(uname -s)/$(uname -m)" >&2
    exit 2
    ;;
esac

TOOL_DIR="$(mktemp -d /tmp/semester-developer-tools.XXXXXX)"
readonly TOOL_DIR

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

readonly SHELLCHECK_ARCHIVE="$TOOL_DIR/shellcheck.tar.gz"
readonly SHELLCHECK_URL="https://github.com/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/shellcheck-v${SHELLCHECK_VERSION}.${SHELLCHECK_TARGET}.tar.gz"
readonly SHELLCHECK="$TOOL_DIR/shellcheck-v${SHELLCHECK_VERSION}/shellcheck"

download "$SHELLCHECK_URL" "$SHELLCHECK_ARCHIVE"
verify_sha256 "$SHELLCHECK_SHA256" "$SHELLCHECK_ARCHIVE"
tar -xzf "$SHELLCHECK_ARCHIVE" -C "$TOOL_DIR"

echo "ShellCheck v${SHELLCHECK_VERSION}: checking tracked shell scripts"
git ls-files -z '*.sh' | xargs -0 "$SHELLCHECK" --severity=warning --

readonly OSV_SCANNER="$TOOL_DIR/osv-scanner"
readonly OSV_URL="https://github.com/google/osv-scanner/releases/download/v${OSV_SCANNER_VERSION}/osv-scanner_${OSV_TARGET}"

download "$OSV_URL" "$OSV_SCANNER"
verify_sha256 "$OSV_SHA256" "$OSV_SCANNER"
chmod 700 "$OSV_SCANNER"

echo "OSV-Scanner v${OSV_SCANNER_VERSION}: checking every supported lockfile"
"$OSV_SCANNER" scan source --recursive .
