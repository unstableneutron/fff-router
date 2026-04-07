#!/usr/bin/env bash
set -euo pipefail

export FFF_ROUTER_ALLOWLIST="${FFF_ROUTER_ALLOWLIST:-/workspace}"

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
  local procdir comm cmd
  for procdir in /proc/[0-9]*; do
    [[ -f "$procdir/comm" ]] || continue
    [[ -f "$procdir/cmdline" ]] || continue
    comm="$(cat "$procdir/comm" 2>/dev/null || true)"
    [[ "$comm" == "bun" ]] || continue
    cmd="$(tr "\0" " " < "$procdir/cmdline" 2>/dev/null || true)"
    case "$cmd" in
      *"bin/fff-routerd.ts"*) count=$((count + 1)) ;;
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
  env "$@" bun bin/fff-find-files.ts coordinator --within /workspace/lib --limit 2 --output-mode json
}

echo "== repo verification =="
bun run check >/dev/null
assert_daemons after-check 0

ensure_rg_tooling

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
out_rg="$(call_json FFF_ROUTER_BACKEND=rg)"
printf '%s\n' "$out_rg"
printf '%s\n' "$out_rg" | grep '"backend_used": "rg"'
assert_daemons after-rg 1

echo "== search_terms compact output still works after backend switch =="
out_terms="$(env FFF_ROUTER_BACKEND=rg bun bin/fff-search-terms.ts SearchCoordinator --within /workspace/lib --limit 2 --output-mode compact)"
printf '%s\n' "$out_terms"
printf '%s\n' "$out_terms" | grep -E 'SearchCoordinator|base_path'
assert_daemons after-terms 1

if command -v fff-mcp >/dev/null 2>&1; then
  echo "== experimental stock fff-mcp backend =="
  out_mcp="$(call_json FFF_ROUTER_BACKEND=fff-mcp)"
  printf '%s\n' "$out_mcp"
  printf '%s\n' "$out_mcp" | grep '"backend_used": "fff-mcp"'
  assert_daemons after-fff-mcp 1
else
  echo "== missing stock fff-mcp binary falls back to rg =="
  out_mcp_fallback="$(call_json FFF_ROUTER_BACKEND=fff-mcp)"
  printf '%s\n' "$out_mcp_fallback"
  printf '%s\n' "$out_mcp_fallback" | grep '"backend_used": "rg"'
  printf '%s\n' "$out_mcp_fallback" | grep '"fallback_applied": true'
  assert_daemons after-fff-mcp-fallback 1
fi

echo "== daemon health endpoint =="
bun -e 'const res = await fetch("http://127.0.0.1:4319/health"); if (!res.ok) throw new Error(`health ${res.status}`); const body = await res.json(); if (!body.ok) throw new Error("health payload not ok"); console.log(JSON.stringify(body));'
assert_daemons after-health 1

echo "== stdio compatibility proxy smoke =="
bun - <<'BUN'
import { spawn } from 'node:child_process';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
const child = spawn('bun', ['bin/fff-router-mcp.ts'], { stdio: ['pipe','pipe','pipe'] });
const exit = new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('close', (code, signal) => resolve({ code, signal }));
});
const buffer = new ReadBuffer();
const waitFor = (predicate) => new Promise((resolve) => {
  child.stdout.on('data', function onData(chunk) {
    buffer.append(chunk);
    while (true) {
      const message = buffer.readMessage();
      if (!message) return;
      if (predicate(message)) {
        child.stdout.off('data', onData);
        resolve(message);
        return;
      }
    }
  });
});
child.stdin.write(serializeMessage({ jsonrpc:'2.0', id:1, method:'initialize', params:{ protocolVersion: LATEST_PROTOCOL_VERSION, capabilities:{}, clientInfo:{ name:'docker-proxy', version:'1.0.0' } } }));
await waitFor((m) => m.id === 1);
child.stdin.write(serializeMessage({ jsonrpc:'2.0', method:'notifications/initialized' }));
child.stdin.write(serializeMessage({ jsonrpc:'2.0', id:2, method:'tools/call', params:{ name:'fff_find_files', arguments:{ query:'coordinator', within:'/workspace/lib' } } }));
const result = await waitFor((m) => m.id === 2);
if (JSON.stringify(result).indexOf('coordinator') < 0) throw new Error('proxy result missing expected content');
child.stdin.end();
const close = await exit;
if (close.code !== 0) throw new Error(`proxy exit ${close.code}`);
BUN
assert_daemons after-proxy 1

echo "Docker validation completed successfully."
