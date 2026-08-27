import type { PublicToolRequest, Result, RouterError } from "./types";
export declare function encodeCursor(args: {
    root: string;
    generation: number;
    request: PublicToolRequest;
    upstreamCursor: string;
}): string;
export declare function decodeCursor(args: {
    cursor: string;
    root: string;
    generation: number;
    request: PublicToolRequest;
}): Result<string, RouterError>;
