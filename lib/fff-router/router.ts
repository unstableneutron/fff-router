import { planDaemonAction } from "./daemon-state";
import { deriveRoutingTarget } from "./routing";
import { parseRouterRequest } from "./schema";
import type {
	DaemonRegistryState,
	ResolvedSearchPath,
	Result,
	RouterConfig,
	RouterRequest,
	RouterResponse,
} from "./types";

type PlanRequestArgs = {
	rawRequest: unknown;
	config: RouterConfig;
	state: DaemonRegistryState;
	resolvePath: (searchPath: string) => Promise<Result<ResolvedSearchPath>>;
};

type PlannedRequest = {
	nextState: DaemonRegistryState;
	action: ReturnType<typeof planDaemonAction>["action"];
	response: RouterResponse;
	request: RouterRequest;
	evicted: string[];
};

// This planner is intentionally pure: callers must serialize state updates around
// planRequest() so concurrent requests do not race on stale snapshots.
export async function planRequest(
	args: PlanRequestArgs,
): Promise<Result<PlannedRequest>> {
	const parsed = parseRouterRequest(args.rawRequest);
	if (!parsed.ok) {
		return parsed;
	}

	let resolved: Result<ResolvedSearchPath>;
	try {
		resolved = await args.resolvePath(parsed.value.searchPath);
	} catch {
		return {
			ok: false,
			error: {
				code: "SEARCH_PATH_REALPATH_FAILED",
				message: `failed to resolve '${parsed.value.searchPath}'`,
			},
		};
	}

	if (!resolved.ok) {
		return resolved;
	}

	const routed = deriveRoutingTarget({
		realPath: resolved.value.realPath,
		statType: resolved.value.statType,
		gitRoot: resolved.value.gitRoot,
		config: args.config,
	});
	if (!routed.ok) {
		return routed;
	}

	const daemonPlan = planDaemonAction(args.state, routed.value, args.config);
	const response: RouterResponse = {
		backend_mode:
			daemonPlan.action.type === "run-ephemeral" ? "ephemeral" : "persistent",
		root_type: routed.value.rootType,
		persistence_root: routed.value.persistenceRoot,
		search_scope: routed.value.searchScope,
	};

	return {
		ok: true,
		value: {
			nextState: daemonPlan.nextState,
			action: daemonPlan.action,
			response,
			request: parsed.value,
			evicted: daemonPlan.evicted,
		},
	};
}
