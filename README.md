# fff-router

A planner for routing FFF-style search requests to repo-scoped or allowlisted non-git search backends.

## What this project is

`fff-router` is the **planning layer** for an AI-agent-friendly search system.

Given a raw request like:

- `search_code` with an absolute `search_path` and `any_of` literals, or
- `find_files` with an absolute `search_path` and a fuzzy `query`

it will:

1. validate and normalize the request
2. canonicalize the filesystem path
3. decide which persistence root should own the search
4. decide whether the request should:
   - reuse a persistent daemon
   - start a persistent daemon
   - run ephemerally
5. return the **next planner state** plus the routing decision

## What this project is not

This repo currently does **not**:

- spawn `fff-mcp`
- manage real subprocesses
- execute the actual search
- persist planner state to disk

It is intentionally a **pure planner**.

That means the caller owns:

- the in-memory state store
- serialization / locking around state updates
- process execution
- daemon lifecycle side effects

## Current V1 policy

### Request shape

Agent-facing request surface:

- `search_path` — required absolute path
- `search_code.any_of` — required list of literal strings
- `find_files.query` — required string
- `exclude_paths` — optional literal descendant paths
- `extensions` — optional literal suffix filters
- pagination / output fields where applicable

V1 intentionally does **not** support:

- `cwd`
- include globs
- exclude globs
- include paths
- regex mode in the main search request shape

### Routing / persistence policy

- **Git roots**
  - routed to the top-level git root
  - persistent immediately
  - TTL: **60 minutes**

- **Allowlisted non-git roots**
  - routed by allowlist prefix + `first-child-root`
  - first hit is ephemeral
  - promote to persistent after **2 hits in 10 minutes**
  - TTL: **15 minutes**

- **Outside git + outside allowlist**
  - explicitly blocked

- **Exact allowlist prefix**
  - blocked in V1
  - only first-child roots are valid persistence roots

## Project layout

- `lib/fff-router/schema.ts` — request validation and normalization
- `lib/fff-router/resolve-path.ts` — `search_path` canonicalization and git-root discovery
- `lib/fff-router/routing.ts` — root derivation and allowlist policy
- `lib/fff-router/daemon-state.ts` — promotion, TTL, and eviction planning
- `lib/fff-router/router.ts` — top-level `planRequest()` orchestration
- `lib/fff-router/*.test.ts` — unit and planner tests

## Install

```bash
bun install
```

## Run tests

```bash
bun test
```

## Core API

### `planRequest()`

Main entry point:

```ts
import { planRequest } from "./lib/fff-router/router";
import { resolveSearchPath } from "./lib/fff-router/resolve-path";
import type { DaemonRegistryState, RouterConfig } from "./lib/fff-router/types";
```

It takes:

- `rawRequest` — JSON-like input from a caller
- `config` — allowlist + promotion/TTL/cap policy
- `state` — current planner state
- `resolvePath` — async dependency used to canonicalize `search_path`

It returns either:

- `{ ok: true, value: { request, response, action, nextState, evicted } }`, or
- `{ ok: false, error: { code, message } }`

## Example configuration

```ts
import type { RouterConfig } from "./lib/fff-router/types";

const config: RouterConfig = {
  allowlistedNonGitPrefixes: [
    {
      prefix: "/Users/thinh/.local/share/mise/installs",
      mode: "first-child-root",
    },
  ],
  promotion: {
    windowMs: 10 * 60 * 1000,
    requiredHits: 2,
  },
  ttl: {
    gitMs: 60 * 60 * 1000,
    nonGitMs: 15 * 60 * 1000,
  },
  limits: {
    maxPersistentDaemons: 12,
    maxPersistentNonGitDaemons: 4,
  },
};
```

## Example: planning a `search_code` request inside a git repo

```ts
import { planRequest } from "./lib/fff-router/router";
import { resolveSearchPath } from "./lib/fff-router/resolve-path";
import type { DaemonRegistryState } from "./lib/fff-router/types";

const state: DaemonRegistryState = {
  daemons: {},
  nonGitRecentHits: {},
  now: Date.now(),
};

const result = await planRequest({
  rawRequest: {
    tool: "search_code",
    search_path: "/Users/thinh/Projects/fff-router/lib",
    any_of: ["planRequest", "resolveSearchPath"],
    exclude_paths: ["generated"],
    extensions: ["ts"],
    context_lines: 1,
    max_results: 20,
    output_mode: "content",
  },
  config,
  state,
  resolvePath: resolveSearchPath,
});

if (!result.ok) {
  console.error(result.error);
} else {
  console.log(result.value.action);
  console.log(result.value.response);
  console.log(result.value.nextState);
}
```

Typical shape of a successful response:

```ts
{
  action: { type: "start-persistent", key: "/Users/thinh/Projects/fff-router" },
  response: {
    backend_mode: "persistent",
    root_type: "git",
    persistence_root: "/Users/thinh/Projects/fff-router",
    search_scope: "/Users/thinh/Projects/fff-router/lib"
  },
  nextState: {
    daemons: {
      "/Users/thinh/Projects/fff-router": {
        key: "/Users/thinh/Projects/fff-router",
        persistenceRoot: "/Users/thinh/Projects/fff-router",
        rootType: "git",
        status: "running",
        createdAt: 1712345678901,
        lastUsedAt: 1712345678901,
        ttlMs: 3600000
      }
    },
    nonGitRecentHits: {},
    now: 1712345678901
  }
}
```

## Example: planning a `find_files` request in an allowlisted non-git tree

```ts
import { planRequest } from "./lib/fff-router/router";
import { resolveSearchPath } from "./lib/fff-router/resolve-path";
import type { DaemonRegistryState } from "./lib/fff-router/types";

let state: DaemonRegistryState = {
  daemons: {},
  nonGitRecentHits: {},
  now: Date.now(),
};

const first = await planRequest({
  rawRequest: {
    tool: "find_files",
    search_path: "/Users/thinh/.local/share/mise/installs/npm-gitchamber/latest",
    query: "finder",
    extensions: ["ts"],
  },
  config,
  state,
  resolvePath: resolveSearchPath,
});

if (!first.ok) {
  throw new Error(first.error.message);
}

console.log(first.value.action.type);
// => "run-ephemeral"

state = {
  ...first.value.nextState,
  now: state.now + 5 * 60 * 1000,
};

const second = await planRequest({
  rawRequest: {
    tool: "find_files",
    search_path: "/Users/thinh/.local/share/mise/installs/npm-gitchamber/latest",
    query: "finder",
    extensions: ["ts"],
  },
  config,
  state,
  resolvePath: resolveSearchPath,
});

if (!second.ok) {
  throw new Error(second.error.message);
}

console.log(second.value.action.type);
// => "start-persistent"
```

## Lower-level APIs

You can also use the modules independently.

### Validate / normalize only

```ts
import { parseRouterRequest } from "./lib/fff-router/schema";

const parsed = parseRouterRequest({
  tool: "find_files",
  search_path: "/tmp/project",
  query: "auth model",
});
```

### Resolve filesystem path only

```ts
import { resolveSearchPath } from "./lib/fff-router/resolve-path";

const resolved = await resolveSearchPath("/Users/thinh/Projects/fff-router/lib");
```

### Plan daemon action only

```ts
import { planDaemonAction } from "./lib/fff-router/daemon-state";
```

Useful when a higher layer already knows the routing target and only wants TTL / promotion / eviction planning.

## Error codes

Current structured error codes:

- `SEARCH_PATH_NOT_ABSOLUTE`
- `SEARCH_PATH_NOT_FOUND`
- `SEARCH_PATH_REALPATH_FAILED`
- `INVALID_REQUEST`
- `OUTSIDE_ALLOWED_SCOPE`
- `DAEMON_START_FAILED`
- `DAEMON_UNAVAILABLE`

## Important integration note

`planRequest()` is intentionally pure.

If two callers plan from the same stale `state`, they can both decide to start or reuse inconsistent daemons. The caller must therefore **serialize planner state updates** around:

1. read current state
2. call `planRequest()`
3. apply returned `nextState`
4. run any side effects

This repo does not implement that lock/serialization layer yet.

## Current status

The planner implementation is covered by Bun tests and currently verifies:

- strict request validation
- path canonicalization
- git-root discovery
- exact-prefix allowlist blocking
- non-git promotion windows
- TTL expiration boundary behavior
- mixed-cap eviction behavior
- planner-level error propagation

---

If you want, the next natural step is to add either:

1. a small CLI demo around `planRequest()`, or
2. a real daemon/executor layer that turns planner decisions into `fff-mcp` process actions.
