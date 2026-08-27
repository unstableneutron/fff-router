#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "usage: native-live-smoke.sh <fff-binary> [repository]" >&2
  exit 2
fi

binary="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
repository="$(cd "${2:-.}" && pwd)"
curl_bin="$(command -v curl)"
jq_bin="$(command -v jq)"
shasum_bin="$(command -v shasum)"
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) worker_target=x86_64-unknown-linux-musl ;;
  Linux-aarch64|Linux-arm64) worker_target=aarch64-unknown-linux-musl ;;
  Darwin-arm64) worker_target=aarch64-apple-darwin ;;
  *) echo "unsupported native smoke host: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

smoke_root="$(mktemp -d "${RUNNER_TEMP:-/tmp}/fff-native-smoke.XXXXXX")"
export HOME="$smoke_root/home"
export XDG_CONFIG_HOME="$smoke_root/config"
export XDG_STATE_HOME="$smoke_root/state"
export FFF_MCP_INSTALL_DIR="$smoke_root/bin"
mkdir -p "$HOME" "$XDG_CONFIG_HOME" "$XDG_STATE_HOME" "$FFF_MCP_INSTALL_DIR"
export PATH="$FFF_MCP_INSTALL_DIR:/usr/bin:/bin:/usr/sbin:/sbin"

cleanup() {
  "$binary" daemon stop >/dev/null 2>&1 || true
  rm -rf "$smoke_root"
}
trap cleanup EXIT

if command -v node >/dev/null 2>&1; then
  echo "native smoke PATH unexpectedly contains Node.js" >&2
  exit 1
fi

worker_url="https://github.com/dmtrKovalenko/fff/releases/download/v0.10.5/fff-mcp-${worker_target}"
"$curl_bin" --fail --location --silent --show-error "$worker_url" --output "$FFF_MCP_INSTALL_DIR/fff-mcp"
"$curl_bin" --fail --location --silent --show-error "${worker_url}.sha256" --output "$smoke_root/fff-mcp.sha256"
expected_digest="$(awk 'NR == 1 { print $1 }' "$smoke_root/fff-mcp.sha256")"
actual_digest="$("$shasum_bin" -a 256 "$FFF_MCP_INSTALL_DIR/fff-mcp" | awk '{ print $1 }')"
test "$actual_digest" = "$expected_digest"
chmod 755 "$FFF_MCP_INSTALL_DIR/fff-mcp"

"$binary" warm "$repository" --json >"$smoke_root/warm.json"
"$binary" find router --within "$repository" --json >"$smoke_root/find.json"
"$binary" grep createRouterService --within "$repository" --json >"$smoke_root/grep.json"
sleep 6
"$binary" status --json >"$smoke_root/status.json"

warm_generation="$("$jq_bin" -er '.workers[0].generation' "$smoke_root/warm.json")"
find_generation="$("$jq_bin" -er '.stats.workerGeneration' "$smoke_root/find.json")"
grep_generation="$("$jq_bin" -er '.stats.workerGeneration' "$smoke_root/grep.json")"
test "$warm_generation" = "$find_generation"
test "$find_generation" = "$grep_generation"
"$jq_bin" -e '.items | length > 0' "$smoke_root/find.json" >/dev/null
"$jq_bin" -e '.items | length > 0' "$smoke_root/grep.json" >/dev/null
"$jq_bin" -e '.workers[0].resources.rssBytes > 0 and .workers[0].resources.processCount >= 1' \
  "$smoke_root/status.json" >/dev/null

echo "native smoke passed: generation $find_generation"
