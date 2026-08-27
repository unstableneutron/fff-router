export type Result<T, TError extends { code: string; message: string } = RouterError> =
  | { ok: true; value: T }
  | { ok: false; error: TError };

export type RouterErrorCode =
  | "INVALID_REQUEST"
  | "WITHIN_NOT_FOUND"
  | "OUTSIDE_ALLOWED_SCOPE"
  | "WORKER_UNAVAILABLE"
  | "WORKER_LIMIT_REACHED"
  | "SEARCH_FAILED"
  | "DEADLINE_EXCEEDED"
  | "CURSOR_INVALID"
  | "CURSOR_EXPIRED"
  | "DAEMON_START_FAILED"
  | "DAEMON_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | "SEARCH_PATH_NOT_ABSOLUTE"
  | "SEARCH_PATH_NOT_FOUND"
  | "SEARCH_PATH_REALPATH_FAILED";

export type RouterError = {
  code: RouterErrorCode;
  message: string;
  retryable?: boolean;
};

export type PublicToolName = "find_files" | "grep";
export type SearchQueryKind = "find_files" | "grep";
export type SearchBackendId = "fff-mcp";

export type PublicRequestBase = {
  within: string[];
  glob?: string;
  extensions: string[];
  excludePaths: string[];
  limit: number;
  cursor: string | null;
};

export type PublicFindFilesRequest = PublicRequestBase & {
  tool: "find_files";
  query: string;
};

export type PublicGrepRequest = PublicRequestBase & {
  tool: "grep";
  patterns: string[];
  literal: boolean;
  contextLines: number;
};

export type PublicToolRequest = PublicFindFilesRequest | PublicGrepRequest;

export type FileHit = {
  path: string;
  absolutePath: string;
};

export type TextHit = FileHit & {
  line: number;
  text: string;
  column?: number;
  contextBefore?: string[];
  contextAfter?: string[];
  isDefinition?: boolean;
  definitionBody?: string[];
};

export type ReadRecommendation = {
  path: string;
  absolutePath: string;
  reason?: string;
};

export type SearchResultStats = {
  resultCount: number;
  upstreamShownCount?: number;
  upstreamTotalCount?: number;
  coldStart: boolean;
  workerId: string;
  workerGeneration: number;
};

type SearchResultBase = {
  root: string;
  backend: "fff-mcp";
  nextCursor: string | null;
  stats: SearchResultStats;
  readRecommendation?: ReadRecommendation;
  /** Native fff-mcp rendering for agent and human presentation. */
  displayText?: string;
};

export type FindFilesResult = SearchResultBase & {
  tool: "find_files";
  items: FileHit[];
};

export type GrepResult = SearchResultBase & {
  tool: "grep";
  items: TextHit[];
};

export type PublicToolResult = FindFilesResult | GrepResult;

export type ResolvedWithinFromCaller = {
  resolvedWithin: string;
};

export type ResolvedWithinPathsFromCaller = {
  resolvedWithinPaths: string[];
};

export type ValidatedWithinEntry = {
  resolvedWithin: string;
  basePath: string;
  fileRestriction?: string;
};

export type ValidatedWithin = ValidatedWithinEntry & {
  additionalEntries?: ValidatedWithinEntry[];
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

export type RouterConfig = {
  allowlistedNonGitPrefixes: AllowlistedPrefix[];
  warmRoots: string[];
  ttl: { gitMs: number; nonGitMs: number };
  limits: {
    maxWorkers: number;
    maxNonGitWorkers: number;
    maxWorkerRssBytes?: number;
    maxTotalWorkerRssBytes?: number;
  };
  runtime: {
    toolTimeoutMs: number;
    sweepIntervalMs: number;
    restartBackoffMs: number;
    restartBackoffMaxMs?: number;
    processSampleIntervalMs?: number;
    processShutdownGraceMs?: number;
    processKillGraceMs?: number;
    workerOrphanIdleTimeoutMs?: number;
    daemonIdleTimeoutMs?: number;
  };
};

export type RoutingTarget = {
  rootType: "git" | "non-git";
  persistenceRoot: string;
  searchScope: string;
  ttlMs: number;
};

export type WorkerDiagnostic = {
  root: string;
  rootType: "git" | "non-git";
  state: "starting" | "ready" | "draining" | "dead";
  workerId?: string;
  pid?: number | null;
  generation: number;
  activeLeases: number;
  startedAt?: number;
  lastUsedAt: number;
  lastCallAt?: number;
  lastSuccessAt?: number;
  lastError?: string;
  lastErrorAt?: number;
  failureCount: number;
  retryAfter?: number;
  resources?: WorkerResourceUsage;
  terminationReason?: string;
};

export type RouterStatus = {
  workers: WorkerDiagnostic[];
  limits: RouterConfig["limits"];
  resources?: {
    sampledAt: number;
    daemonRssBytes: number;
    workerRssBytes: number;
    totalRssBytes: number;
    measuredWorkers: number;
  };
};

export type WorkerResourceUsage = {
  sampledAt: number;
  rssBytes: number;
  cpuTimeMs?: number;
  threads?: number;
  processCount?: number;
};

export type WorkerSupervisionTelemetry = {
  resources: WorkerResourceUsage | null;
  terminationReason: string | null;
};

export interface RouterService {
  execute(request: PublicToolRequest): Promise<Result<PublicToolResult>>;
  warm(within: string[]): Promise<Result<WorkerDiagnostic[]>>;
  evict(within: string[]): Promise<Result<{ evicted: string[] }>>;
  status(): RouterStatus;
  close(): Promise<void>;
}
