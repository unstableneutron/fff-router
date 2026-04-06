# fff-router

`fff-router` is the shared search service for FFF-backed code search.

It exposes exactly three public tools:

- `fff_find_files`
- `fff_search_terms`
- `fff_grep`

The repo now contains:

- a public API surface
- `within` resolution helpers
- generic routing/lifecycle planning
- a shared runtime manager
- pluggable backend adapters
- a search coordinator
- an MCP stdio server: `fff-router-mcp`
- thin CLI wrappers that call the shared service through `mcporter`

## Architecture

### Public contract

The public tool shapes are structured, not stringly.

Common fields:

- `within`
- `extensions`
- `exclude_paths`
- `limit`
- `cursor`
- `output_mode`

Supported output modes:

- `compact` (default)
- `json`

Initial pagination is intentionally deferred:

- request `cursor` must be omitted or `null`
- responses always return `next_cursor: null`

### `within` semantics

`within` is a client-side scope field.

Clients must:

- default omitted `within` to the caller cwd
- resolve relative `within` against the caller cwd
- send the already-resolved absolute value to `fff-router-mcp`

Server-side behavior:

- validate/canonicalize the already-resolved absolute `within`
- if `within` is a file:
  - `base_path` becomes the file’s parent directory
  - the coordinator applies an implicit single-file restriction internally

### Backend policy

Primary path:

- `fff-mcp` / FFF-backed execution

Fallback path:

- `rg` / `fd`

Fallback happens only on backend failure, not on zero results.

### Shared runtime topology

`fff-router-mcp` remains a plain stdio MCP server.

Shared machine-wide reuse happens through `mcporter` with the canonical target name:

- `fff-router`

All supported clients should use that same target if they want shared warm reuse:

- the CLI wrappers in this repo
- the Pi thin forwarder

Direct raw stdio execution of `fff-router-mcp` is for debugging only.

## Repo layout

### Core modules

- `lib/fff-router/public-api.ts` — public tool schemas and input normalization
- `lib/fff-router/resolve-within.ts` — client/server `within` helpers
- `lib/fff-router/routing.ts` — persistence root derivation
- `lib/fff-router/lifecycle.ts` — lifecycle planning and eviction policy
- `lib/fff-router/runtime-manager.ts` — shared runtime registry and startup dedupe
- `lib/fff-router/adapters/fff-mcp.ts` — primary FFF-backed adapter
- `lib/fff-router/adapters/rg-fd.ts` — fallback adapter
- `lib/fff-router/coordinator.ts` — top-level search coordinator
- `lib/fff-router/mcp-tools.ts` — MCP tool definitions and execution bridge
- `lib/fff-router/mcp-server.ts` — MCP server assembly

### Entrypoints

- `bin/fff-router-mcp.ts` — stdio MCP server
- `bin/fff-find-files.ts` — mcporter-backed wrapper
- `bin/fff-search-terms.ts` — mcporter-backed wrapper
- `bin/fff-grep.ts` — mcporter-backed wrapper

### Shared mcporter target config

- `config/mcporter.json`

This repo config defines the shared target name:

- `fff-router`

## Install

```bash
bun install
```

## Verify

```bash
bun run test
```

## Debug-run the MCP server directly

This is useful for local debugging only.

```bash
bun run bin/fff-router-mcp.ts
```

## CLI wrappers

These wrappers are thin clients.

They:

- default omitted `within` to the wrapper caller cwd
- resolve relative `within` against the wrapper caller cwd
- call the shared mcporter target `fff-router`

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

### Shared mcporter target

The wrappers use:

- target name `fff-router`
- config file `config/mcporter.json`

If you override the target, use:

- `--target <name>` or
- `FFF_ROUTER_MCPORTER_TARGET=<name>`

## mcporter topology

If you want machine-wide shared reuse, all clients must use the same mcporter-managed target definition.

In this repo that means:

- target name: `fff-router`
- config: `config/mcporter.json`

The wrappers and the Pi forwarder should both use that same target/config path:

- target: `fff-router`
- config: `/Users/thinh/Projects/fff-router/config/mcporter.json`

Do **not** bypass mcporter if shared reuse is desired.

## Pi integration

The supported Pi path is a thin forwarder at:

- `~/.pi/agent/extensions/pi-fff-search/index.ts`

It should:

- default omitted `within` to the Pi start cwd
- resolve relative `within` against the Pi start cwd
- forward the already-resolved request to the shared mcporter target `fff-router`

It should **not** own:

- public schemas
- search policy
- runtime caches
- upstream FFF process management

Direct Pi connection to raw `fff-router-mcp` is not the intended initial path.

## Current tool names

The public names are locked:

- `fff_find_files`
- `fff_search_terms`
- `fff_grep`
