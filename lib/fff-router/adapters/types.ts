import type {
  Result,
  RuntimeRequestKey,
  SearchBackendId,
  SearchQueryKind,
  ValidatedWithinEntry,
} from "../types";

export type SearchBackendRuntime = {
  id: string;
  close: () => Promise<void> | void;
};

export type RuntimeStartSpec<TRuntime extends SearchBackendRuntime = SearchBackendRuntime> =
  RuntimeRequestKey & {
    start: () => Promise<TRuntime>;
  };

export type BackendRequestBase = RuntimeRequestKey & {
  within: string;
  basePath: string;
  fileRestriction?: string;
  /**
   * Extra within entries for multi-path requests. Omitted (or empty) for
   * single-path requests so existing adapters and tests that construct
   * `BackendRequestBase` literals keep working. Multi-path-aware adapters
   * should read `additionalWithinEntries ?? []` and branch on length;
   * adapters that don't support multi-path should reject when the array
   * is non-empty rather than silently dropping the extras.
   */
  additionalWithinEntries?: ValidatedWithinEntry[];
  glob?: string;
  extensions: string[];
  excludePaths: string[];
  limit: number;
};

export type FindFilesBackendRequest = BackendRequestBase & {
  queryKind: "find_files";
  query: string;
};

export type SearchTermsBackendRequest = BackendRequestBase & {
  queryKind: "search_terms";
  terms: string[];
  contextLines: number;
};

export type GrepBackendRequest = BackendRequestBase & {
  queryKind: "grep";
  patterns: string[];
  literal: boolean;
  caseSensitive: boolean;
  contextLines: number;
};

export type BackendSearchRequest =
  | FindFilesBackendRequest
  | SearchTermsBackendRequest
  | GrepBackendRequest;

export type BackendFileItem = {
  path: string;
  relativePath: string;
};

export type BackendTextMatch = {
  path: string;
  relativePath: string;
  line: number;
  text: string;
  column?: number;
  contextBefore?: string[];
  contextAfter?: string[];
  isDefinition?: boolean;
  definitionBody?: string[];
};

export type BackendResultItem = BackendFileItem | BackendTextMatch;

export type BackendSearchError = {
  code: "BACKEND_UNAVAILABLE" | "SEARCH_FAILED";
  message: string;
  backendId: SearchBackendId;
};

export type BackendSearchSummary = {
  shownCount?: number;
  totalCount?: number;
  readRecommendation?: {
    relativePath: string;
    reason?: string;
  };
};

export type BackendSearchSuccess = {
  backendId: SearchBackendId;
  queryKind: SearchQueryKind;
  items: BackendResultItem[];
  nextCursor: null;
  renderedCompact?: string;
  summary?: BackendSearchSummary;
};

export type BackendSearchResult = Result<BackendSearchSuccess, BackendSearchError>;

export interface SearchBackendAdapter<
  TRuntime extends SearchBackendRuntime = SearchBackendRuntime,
> {
  readonly backendId: SearchBackendId;
  readonly supportedQueryKinds: SearchQueryKind[];
  startRuntime?: (args: RuntimeRequestKey) => Promise<TRuntime>;
  execute: (args: {
    request: BackendSearchRequest;
    runtime?: TRuntime;
  }) => Promise<BackendSearchResult>;
}
