import type {
	PublicError,
	PublicToolResult,
	Result,
	RuntimeRequestKey,
	SearchBackendId,
	SearchQueryKind,
} from "../types";

export type SearchBackendRuntime = {
	id: string;
	close: () => Promise<void> | void;
};

export type RuntimeStartSpec<
	TRuntime extends SearchBackendRuntime = SearchBackendRuntime,
> = RuntimeRequestKey & {
	start: () => Promise<TRuntime>;
};

export type BackendExecutionRequest = {
	queryKind: SearchQueryKind;
	within: string;
	basePath: string;
	fileRestriction?: string;
	extensions: string[];
	excludePaths: string[];
	limit: number;
	contextLines?: number;
	query?: string;
	terms?: string[];
	pattern?: string;
	caseSensitive?: boolean;
};

export type BackendExecutionSuccess = {
	backendId: SearchBackendId;
	items: PublicToolResult["items"];
};

export type BackendExecutionResult = Result<
	BackendExecutionSuccess,
	PublicError
>;
