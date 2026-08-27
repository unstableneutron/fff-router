import type { BackendResultItem, BackendSearchRequest } from "./types";
export declare function normalizeRelativePath(relativePath: string): string;
export declare function pathWithinScope(request: BackendSearchRequest, candidatePath: string): boolean;
export declare function matchesExtension(extensions: string[], relativePath: string): boolean;
export declare function matchesGlob(glob: string | undefined, relativePath: string): boolean;
export declare function matchesExcludePaths(excludePaths: string[], relativePath: string): boolean;
export declare function filterItems(request: BackendSearchRequest, items: BackendResultItem[]): BackendResultItem[];
export declare function toRelativePath(persistenceRoot: string, absolutePath: string): string;
