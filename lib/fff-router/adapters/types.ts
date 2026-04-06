import type { Result, RuntimeRequestKey, SearchBackendId, SearchQueryKind } from "../types";

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
  pattern: string;
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
};

export type BackendResultItem = BackendFileItem | BackendTextMatch;

export type BackendSearchError = {
  code: "BACKEND_UNAVAILABLE" | "SEARCH_FAILED";
  message: string;
  backendId: SearchBackendId;
};

export type BackendSearchSuccess = {
  backendId: SearchBackendId;
  queryKind: SearchQueryKind;
  items: BackendResultItem[];
  nextCursor: null;
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
