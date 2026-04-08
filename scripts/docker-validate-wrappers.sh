#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="${HOME}/.config/fff-routerd"
CONFIG_FILE="${CONFIG_DIR}/config.json"

write_config() {
  local backend="$1"
  mkdir -p "$CONFIG_DIR"
  cat > "$CONFIG_FILE" <<JSON
{
  "host": "127.0.0.1",
  "port": 4319,
  "mcpPath": "/mcp",
  "backend": "$backend",
  "allowlist": ["/workspace"]
}
JSON
}

ensure_rg_tooling() {
  if command -v rg >/dev/null 2>&1 && command -v fd >/dev/null 2>&1; then
    return
  fi

  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update >/dev/null
    apt-get install -y ripgrep fd-find >/dev/null
    if ! command -v fd >/dev/null 2>&1 && command -v fdfind >/dev/null 2>&1; then
      ln -sf "$(command -v fdfind)" /usr/local/bin/fd
    fi
    return
  fi

  echo "Missing rg/fd tooling and no supported package manager found" >&2
  exit 1
}

count_daemons() {
  local count=0
  local procdir cmd
  for procdir in /proc/[0-9]*; do
    [[ -f "$procdir/cmdline" ]] || continue
    cmd="$(tr "\0" " " < "$procdir/cmdline" 2>/dev/null || true)"
    case "$cmd" in
      *"dist/bin/fff-routerd.js"*|*"fff-routerd"*) count=$((count + 1)) ;;
    esac
  done
  echo "$count"
}

assert_daemons() {
  local label="$1"
  local expected="$2"
  local count
  count="$(count_daemons)"
  echo "[$label] daemon_count=$count"
  [[ "$count" -eq "$expected" ]]
}

call_json() {
  bun bin/fff-find-files.ts coordinator --within /workspace/lib --limit 2 --output-mode json
}

echo "== repo verification =="
bun run check >/dev/null
assert_daemons after-check 0

ensure_rg_tooling

write_config fff-node

echo "== wrapper help =="
bun bin/fff-find-files.ts --help >/dev/null
bun bin/fff-search-terms.ts --help >/dev/null
bun bin/fff-grep.ts --help >/dev/null
assert_daemons after-help 0

echo "== default backend (fff-node) auto-starts daemon =="
out_default="$(call_json)"
printf '%s\n' "$out_default"
printf '%s\n' "$out_default" | grep '"backend_used": "fff-node"'
assert_daemons after-default 1

echo "== switching backend to rg replaces daemon config transparently =="
write_config rg
out_rg="$(call_json)"
printf '%s\n' "$out_rg"
printf '%s\n' "$out_rg" | grep '"backend_used": "rg"'
assert_daemons after-rg 1

echo "== search_terms compact output still works after backend switch =="
out_terms="$(bun bin/fff-search-terms.ts SearchCoordinator --within /workspace/lib --limit 2 --output-mode compact)"
printf '%s\n' "$out_terms"
printf '%s\n' "$out_terms" | grep -E 'SearchCoordinator|base_path'
assert_daemons after-terms 1

if command -v fff-mcp >/dev/null 2>&1; then
  echo "== experimental stock fff-mcp backend =="
  write_config fff-mcp
  out_mcp="$(call_json)"
  printf '%s\n' "$out_mcp"
  printf '%s\n' "$out_mcp" | grep '"backend_used": "fff-mcp"'
  assert_daemons after-fff-mcp 1
else
  echo "== missing stock fff-mcp binary falls back to rg =="
  write_config fff-mcp
  out_mcp_fallback="$(call_json)"
  printf '%s\n' "$out_mcp_fallback"
  printf '%s\n' "$out_mcp_fallback" | grep '"backend_used": "rg"'
  printf '%s\n' "$out_mcp_fallback" | grep '"fallback_applied": true'
  assert_daemons after-fff-mcp-fallback 1
fi

echo "== daemon health endpoint =="
bun -e 'const res = await fetch("http://127.0.0.1:4319/health"); if (!res.ok) throw new Error(`health ${res.status}`); const body = await res.json(); if (!body.ok) throw new Error("health payload not ok"); console.log(JSON.stringify(body));'
assert_daemons after-health 1

echo "== daemon doctor =="
bun bin/fff-routerd.ts doctor
assert_daemons after-doctor 1

echo "Docker validation completed successfully."
