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

export type Result<T, TError extends { code: string; message: string } = RouterError> =
  | { ok: true; value: T }
  | { ok: false; error: TError };

export type PublicToolName = "fff_find_files" | "fff_search_terms" | "fff_grep";

export type PublicOutputMode = "compact" | "json";

export type PublicErrorCode =
  | "INVALID_REQUEST"
  | "WITHIN_NOT_FOUND"
  | "OUTSIDE_ALLOWED_SCOPE"
  | "BACKEND_UNAVAILABLE"
  | "SEARCH_FAILED"
  | "INTERNAL_ERROR";

export type PublicError = {
  code: PublicErrorCode;
  message: string;
};

export type PublicRequestBase = {
  within?: string;
  glob?: string;
  extensions: string[];
  excludePaths: string[];
  limit: number;
  cursor: null;
  outputMode: PublicOutputMode;
};

export type PublicFindFilesRequest = PublicRequestBase & {
  tool: "fff_find_files";
  query: string;
};

export type PublicSearchTermsRequest = PublicRequestBase & {
  tool: "fff_search_terms";
  terms: string[];
  contextLines: number;
};

export type PublicGrepRequest = PublicRequestBase & {
  tool: "fff_grep";
  patterns: string[];
  caseSensitive: boolean;
  contextLines: number;
};

export type PublicToolRequest =
  | PublicFindFilesRequest
  | PublicSearchTermsRequest
  | PublicGrepRequest;

export type PublicCompactFindFilesResult = {
  mode: "compact";
  base_path: string;
  next_cursor: null;
  items: Array<{ path: string }>;
};

export type PublicCompactTextMatch = {
  path: string;
  line: number;
  text: string;
};

export type PublicCompactSearchTermsResult = {
  mode: "compact";
  base_path: string;
  next_cursor: null;
  items: PublicCompactTextMatch[];
};

export type PublicCompactGrepResult = {
  mode: "compact";
  base_path: string;
  next_cursor: null;
  items: PublicCompactTextMatch[];
};

export type PublicCompactRenderedTextResult = {
  mode: "compact";
  base_path: string;
  next_cursor: null;
  text: string;
};

export type PublicJsonReadRecommendation = {
  path: string;
  absolute_path: string;
  reason?: string;
};

export type PublicJsonItem = Record<string, unknown>;

export type PublicJsonResult<TItem extends PublicJsonItem = PublicJsonItem> = {
  mode: "json";
  base_path: string;
  next_cursor: null;
  backend_used: string;
  fallback_applied: boolean;
  fallback_reason?: "backend_error";
  stats: {
    result_count: number;
    shown_count?: number;
    total_count?: number;
  };
  read_recommendation?: PublicJsonReadRecommendation;
  items: TItem[];
};

export type PublicToolResult =
  | PublicCompactFindFilesResult
  | PublicCompactSearchTermsResult
  | PublicCompactGrepResult
  | PublicCompactRenderedTextResult
  | PublicJsonResult<PublicJsonItem>;

export type PublicToolDefinition<TSchema = unknown> = {
  name: PublicToolName;
  description: string;
  snippet: string;
  inputSchema: TSchema;
};

export type ResolvedWithinFromCaller = {
  resolvedWithin: string;
};

export type ValidatedWithin = {
  resolvedWithin: string;
  basePath: string;
  fileRestriction?: string;
};

export type ResolvedSearchPath = {
  realPath: string;
  statType: "file" | "directory";
  gitRoot: string | null;
};

export type AllowlistedPrefix = {
  prefix: string;
  mode: "first-child-root";
};

export type SearchQueryKind = "find_files" | "search_terms" | "grep";
export type SearchBackendId = "fff-node" | "fff-mcp" | "rg";

export type RuntimeRegistryKey = string;

export type RuntimeRequestKey = {
  backendId: SearchBackendId;
  persistenceRoot: string;
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

export type RoutingLifecyclePlan = {
  queryKind: SearchQueryKind;
  target: RoutingTarget;
  nextState: DaemonRegistryState;
  action: DaemonAction;
  evicted: string[];
};

export type SearchCoordinatorResult = Result<PublicToolResult, PublicError>;

export interface SearchCoordinator {
  execute(request: PublicToolRequest): Promise<SearchCoordinatorResult>;
}
