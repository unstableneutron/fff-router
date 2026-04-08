# fff-router

`fff-router` is a shared FFF-backed search service.

It exposes exactly three public tools:

- `fff_find_files`
- `fff_search_terms`
- `fff_grep`

## Current architecture

The primary architecture is now:

- one machine-local HTTP MCP daemon: `fff-routerd`
- one shared in-process runtime map inside that daemon
- thin CLI wrappers that call the daemon over MCP HTTP
- an optional stdio compatibility proxy: `fff-router-mcp`

This means machine-wide warm reuse comes from the long-lived daemon process itself.

## Public contract

Common public fields:

- `within`
- `extensions`
- `exclude_paths`
- `limit`
- `cursor`
- `output_mode`

Supported output modes:

- `compact` (default)
- `json`

Pagination is intentionally deferred for now:

- request `cursor` must be omitted or `null`
- responses always return `next_cursor: null`

## `within` semantics

`within` is resolved client-side.

Clients should:

- default omitted `within` to the caller cwd
- resolve relative `within` against the caller cwd
- expand `~/...`, `$HOME/...`, and `${HOME}/...` before absolute-path validation or relative resolution
- send the resolved absolute value to the daemon

Server-side behavior:

- validate and canonicalize the absolute `within`
- if `within` is a file:
  - `base_path` becomes the file’s parent directory
  - the coordinator applies an implicit single-file restriction internally

## Backend selection

The daemon keeps the public API stable while letting you choose the backend through:

- `~/.config/fff-routerd/config.json`
- `~/.config/fff-routerd/config.jsonc`

If both files exist, `config.json` wins.
If neither file exists, `fff-routerd` creates `config.json` with defaults on first run.

Comments are accepted in **either** extension.

Example:

```jsonc
{
  // comments are allowed in config.json and config.jsonc
  "host": "127.0.0.1",
  "port": 4319,
  "mcpPath": "/mcp",
  "backend": "fff-node",
  "allowlist": ["~/.config", "$HOME/.local/share", "$HOME/src"],
  "promotion": { "windowMs": 600000, "requiredHits": 2 },
  "ttl": { "gitMs": 3600000, "nonGitMs": 900000 },
  "limits": { "maxPersistentDaemons": 12, "maxPersistentNonGitDaemons": 4 },
}
```

## Non-git allowlist

Use the `allowlist` array in the config file.

Each prefix is matched recursively for allowlisting. Non-git routing still derives the persistence root using the first child under the matched prefix, while Git repositories under an allowlisted path still take precedence.

Current default:

- `fff-node`

Current fallback matrix:

- `fff-node -> rg`
- `fff-mcp -> rg`
- `rg -> no fallback`

Fallback happens only on backend failure, not on zero results.

### Backend notes

- `fff-node` — direct in-process `@ff-labs/fff-node` runtime owned by `fff-routerd`
- `rg` — direct `rg` / `fd` execution, now also available as an explicit primary backend
- `fff-mcp` — experimental stock upstream `fff-mcp` integration over stdio MCP; request/response mapping is best-effort in this slice because upstream still returns AI-oriented text rather than a structured compatibility contract

## Runtime reuse model

The daemon owns the shared runtime state.

That shared state is still keyed by the routed `persistenceRoot`, so:

- same root => same warm runtime reused
- different root => different runtime entry

Routing and lifecycle policy still come from:

- `lib/fff-router/routing.ts`
- `lib/fff-router/lifecycle.ts`
- `lib/fff-router/runtime-manager.ts`
- `lib/fff-router/coordinator.ts`

## Repo layout

### Core modules

- `lib/fff-router/public-api.ts` — public tool schemas and input normalization
- `lib/fff-router/resolve-within.ts` — client/server `within` helpers
- `lib/fff-router/routing.ts` — persistence root derivation
- `lib/fff-router/lifecycle.ts` — lifecycle planning and eviction policy
- `lib/fff-router/runtime-manager.ts` — shared runtime registry and startup dedupe
- `lib/fff-router/backend-config.ts` — backend selection and fallback defaults
- `lib/fff-router/adapters/fff-node.ts` — direct `@ff-labs/fff-node` adapter
- `lib/fff-router/adapters/fff-mcp-stdio.ts` — experimental stock `fff-mcp` adapter
- `lib/fff-router/adapters/rg.ts` — `rg` / `fd` adapter
- `lib/fff-router/coordinator.ts` — top-level search coordinator
- `lib/fff-router/mcp-tools.ts` — MCP tool definitions and execution bridge
- `lib/fff-router/mcp-server.ts` — MCP server assembly
- `lib/fff-router/http-daemon.ts` — HTTP daemon host
- `lib/fff-router/http-client.ts` — HTTP MCP client helper for wrappers/proxies
- `lib/fff-router/daemon-autostart.ts` — daemon health and auto-start helper

### Entrypoints

- `bin/fff-routerd.ts` — explicit HTTP MCP daemon
- `bin/fff-router-mcp.ts` — stdio compatibility proxy to the daemon
- `bin/fff-find-files.ts` — HTTP MCP wrapper
- `bin/fff-search-terms.ts` — HTTP MCP wrapper
- `bin/fff-grep.ts` — HTTP MCP wrapper

## Install

```bash
bun install
```

## Verify

```bash
bun run test
bun run check
```

## Docker validation

A container-oriented end-to-end validator lives at:

```bash
scripts/docker-validate-wrappers.sh
```

Run it from a Dockerized checkout rooted at `/workspace` with an isolated container `node_modules` volume:

```bash
docker run --rm \
  -v "$PWD":/workspace \
  -v /workspace/node_modules \
  -w /workspace \
  oven/bun:1 \
  bash -lc 'bun install && bash scripts/docker-validate-wrappers.sh'
```

## Start the daemon explicitly

Default bind:

- host: `127.0.0.1`
- port: `4319`
- MCP path: `/mcp`

All daemon configuration comes from `~/.config/fff-routerd/config.json` or `config.jsonc`.

Reload behavior:

- editing `config.json` or `config.jsonc` auto-reloads in place
- sending `SIGHUP` also reloads the file in place
- changing `host`, `port`, or `mcpPath` requires a daemon restart
- changing backend / allowlist / promotion / TTL / limit fields reloads in place
- invalid config file edits cause reload to fail until the file is fixed

Run:

```bash
bun run bin/fff-routerd.ts
```

## CLI wrappers

The wrappers are thin clients.

They:

- default omitted `within` to the wrapper caller cwd
- resolve relative `within` against the wrapper caller cwd
- expand `~/...`, `$HOME/...`, and `${HOME}/...` before resolution
- auto-start the daemon if it is missing
- call the daemon over MCP HTTP

They do **not** own search policy or backend management.

### Help

```bash
bun run bin/fff-find-files.ts --help
bun run bin/fff-search-terms.ts --help
bun run bin/fff-grep.ts --help
```

### Example usage

```bash
bun run bin/fff-find-files.ts router --within src --extension ts
bun run bin/fff-search-terms.ts router coordinator --within lib --context-lines 1
bun run bin/fff-grep.ts 'plan(Request)?' --within lib --case-sensitive
```

## HTTP MCP endpoint

The canonical MCP endpoint is:

- `http://127.0.0.1:4319/mcp`

Other local agents and future extensions should talk to that same endpoint if they want shared warm reuse.

## `fff-router-mcp`

`fff-router-mcp` is no longer the primary runtime owner.

It is now a thin stdio compatibility proxy that forwards MCP tool calls to the HTTP daemon. The shared runtime state lives in `fff-routerd`.

## Pi integration direction

The long-term intended integration is:

- Pi / extensions / wrappers talk directly to the same HTTP MCP daemon

That keeps one shared runtime pool for the whole machine instead of creating per-client warm state.

## Current tool names

The public names remain locked:

- `fff_find_files`
- `fff_search_terms`
- `fff_grep`
