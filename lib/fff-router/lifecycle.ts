import { deriveRoutingTarget } from "./routing";
import type {
  DaemonAction,
  DaemonRecord,
  DaemonRegistryState,
  Result,
  RouterConfig,
  RoutingLifecyclePlan,
  RoutingTarget,
  SearchQueryKind,
} from "./types";

function pruneExpired(state: DaemonRegistryState): {
  daemons: Record<string, DaemonRecord>;
  evicted: string[];
} {
  const daemons: Record<string, DaemonRecord> = {};
  const evicted: string[] = [];

  for (const [key, record] of Object.entries(state.daemons)) {
    if (record.lastUsedAt + record.ttlMs <= state.now) {
      evicted.push(key);
      continue;
    }

    daemons[key] = record;
  }

  return { daemons, evicted };
}

function pruneRecentHits(
  now: number,
  recentHits: Record<string, number[]>,
  config: RouterConfig,
): Record<string, number[]> {
  const next: Record<string, number[]> = {};

  for (const [key, timestamps] of Object.entries(recentHits)) {
    const pruned = timestamps.filter((timestamp) => {
      return now - timestamp <= config.promotion.windowMs;
    });

    if (pruned.length > 0) {
      next[key] = pruned;
    }
  }

  return next;
}

function listLruKeys(
  daemons: Record<string, DaemonRecord>,
  rootType?: "git" | "non-git",
): string[] {
  return Object.values(daemons)
    .filter((record) => (rootType ? record.rootType === rootType : true))
    .sort((left, right) => left.lastUsedAt - right.lastUsedAt)
    .map((record) => record.key);
}

function removeDaemon(daemons: Record<string, DaemonRecord>, key: string, evicted: string[]): void {
  if (!daemons[key]) {
    return;
  }

  delete daemons[key];
  evicted.push(key);
}

function countNonGitDaemons(daemons: Record<string, DaemonRecord>): number {
  return Object.values(daemons).filter((record) => record.rootType === "non-git").length;
}

function clearRecentHitKey(state: DaemonRegistryState, key: string): DaemonRegistryState {
  const nonGitRecentHits = { ...state.nonGitRecentHits };
  delete nonGitRecentHits[key];

  return { ...state, nonGitRecentHits };
}

function enforceLimits(
  state: DaemonRegistryState,
  config: RouterConfig,
): { state: DaemonRegistryState; evicted: string[] } {
  const daemons = { ...state.daemons };
  const evicted: string[] = [];

  const nonGitOverflow = Math.max(
    0,
    countNonGitDaemons(daemons) - config.limits.maxPersistentNonGitDaemons,
  );
  for (const key of listLruKeys(daemons, "non-git").slice(0, nonGitOverflow)) {
    removeDaemon(daemons, key, evicted);
  }

  const totalOverflow = Math.max(
    0,
    Object.keys(daemons).length - config.limits.maxPersistentDaemons,
  );
  for (const key of listLruKeys(daemons).slice(0, totalOverflow)) {
    removeDaemon(daemons, key, evicted);
  }

  const nonGitRecentHits = { ...state.nonGitRecentHits };
  for (const key of evicted) {
    delete nonGitRecentHits[key];
  }

  return {
    state: {
      ...state,
      daemons,
      nonGitRecentHits,
    },
    evicted,
  };
}

export function planDaemonAction(
  state: DaemonRegistryState,
  target: RoutingTarget,
  config: RouterConfig,
): {
  nextState: DaemonRegistryState;
  action: DaemonAction;
  evicted: string[];
} {
  const expired = pruneExpired(state);
  let nextState: DaemonRegistryState = {
    daemons: expired.daemons,
    nonGitRecentHits: pruneRecentHits(state.now, state.nonGitRecentHits, config),
    now: state.now,
  };
  const evicted = [...expired.evicted];

  for (const key of expired.evicted) {
    delete nextState.nonGitRecentHits[key];
  }

  const key = target.persistenceRoot;
  const existing = nextState.daemons[key];
  if (existing) {
    return {
      nextState: {
        ...nextState,
        daemons: {
          ...nextState.daemons,
          [key]: {
            ...existing,
            lastUsedAt: state.now,
          },
        },
      },
      action: { type: "reuse-persistent", key },
      evicted,
    };
  }

  if (target.rootType === "non-git") {
    const hits = [...(nextState.nonGitRecentHits[key] ?? []), state.now];
    nextState = {
      ...nextState,
      nonGitRecentHits: {
        ...nextState.nonGitRecentHits,
        [key]: hits,
      },
    };

    if (hits.length < config.promotion.requiredHits) {
      return {
        nextState,
        action: { type: "run-ephemeral", key },
        evicted,
      };
    }

    nextState = clearRecentHitKey(nextState, key);
  }

  nextState = {
    ...nextState,
    daemons: {
      ...nextState.daemons,
      [key]: {
        key,
        persistenceRoot: target.persistenceRoot,
        rootType: target.rootType,
        status: "running",
        createdAt: state.now,
        lastUsedAt: state.now,
        ttlMs: target.ttlMs,
      },
    },
  };

  const limited = enforceLimits(nextState, config);
  if (!limited.state.daemons[key]) {
    return {
      nextState: limited.state,
      action: { type: "run-ephemeral", key },
      evicted: [...evicted, ...limited.evicted],
    };
  }

  return {
    nextState: limited.state,
    action: { type: "start-persistent", key },
    evicted: [...evicted, ...limited.evicted],
  };
}

export function planRoutingLifecycle(args: {
  queryKind: SearchQueryKind;
  realPath: string;
  statType: "file" | "directory";
  gitRoot: string | null;
  config: RouterConfig;
  state: DaemonRegistryState;
}): Result<RoutingLifecyclePlan> {
  const target = deriveRoutingTarget({
    realPath: args.realPath,
    statType: args.statType,
    gitRoot: args.gitRoot,
    config: args.config,
  });
  if (!target.ok) {
    return target;
  }

  const daemonPlan = planDaemonAction(args.state, target.value, args.config);
  return {
    ok: true,
    value: {
      queryKind: args.queryKind,
      target: target.value,
      nextState: daemonPlan.nextState,
      action: daemonPlan.action,
      evicted: daemonPlan.evicted,
    },
  };
}
