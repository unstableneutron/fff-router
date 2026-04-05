export type RouterTool = "search_code" | "find_files";
export type OutputMode = "content" | "files" | "count";

export type RouterErrorCode =
	| "SEARCH_PATH_NOT_ABSOLUTE"
	| "SEARCH_PATH_NOT_FOUND"
	| "SEARCH_PATH_REALPATH_FAILED"
	| "INVALID_REQUEST"
	| "OUTSIDE_ALLOWED_SCOPE"
	| "DAEMON_START_FAILED"
	| "DAEMON_UNAVAILABLE";

export type RouterError = {
	code: RouterErrorCode;
	message: string;
};

export type Result<T> =
	| { ok: true; value: T }
	| { ok: false; error: RouterError };

export type SearchCodeRequest = {
	tool: "search_code";
	searchPath: string;
	anyOf: string[];
	excludePaths: string[];
	extensions: string[];
	contextLines: number;
	maxResults: number;
	cursor: string | null;
	outputMode: OutputMode;
};

export type FindFilesRequest = {
	tool: "find_files";
	searchPath: string;
	query: string;
	excludePaths: string[];
	extensions: string[];
	maxResults: number;
	cursor: string | null;
};

export type RouterRequest = SearchCodeRequest | FindFilesRequest;

export type ResolvedSearchPath = {
	realPath: string;
	statType: "file" | "directory";
	gitRoot: string | null;
};

export type AllowlistedPrefix = {
	prefix: string;
	mode: "first-child-root";
};

export type RouterConfig = {
	allowlistedNonGitPrefixes: AllowlistedPrefix[];
	promotion: { windowMs: number; requiredHits: number };
	ttl: { gitMs: number; nonGitMs: number };
	limits: { maxPersistentDaemons: number; maxPersistentNonGitDaemons: number };
};

export type RoutingTarget = {
	rootType: "git" | "non-git";
	persistenceRoot: string;
	searchScope: string;
	backendMode: "persistent" | "ephemeral-candidate";
	ttlMs: number;
};

export type DaemonRecord = {
	key: string;
	persistenceRoot: string;
	rootType: "git" | "non-git";
	status: "running";
	createdAt: number;
	lastUsedAt: number;
	ttlMs: number;
};

export type DaemonRegistryState = {
	daemons: Record<string, DaemonRecord>;
	nonGitRecentHits: Record<string, number[]>;
	now: number;
};

export type DaemonAction =
	| { type: "reuse-persistent"; key: string }
	| { type: "start-persistent"; key: string }
	| { type: "run-ephemeral"; key: string };

export type RouterResponse = {
	backend_mode: "persistent" | "ephemeral";
	root_type: "git" | "non-git";
	persistence_root: string;
	search_scope: string;
};
