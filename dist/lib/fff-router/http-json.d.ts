export type JsonHttpResponse = {
    status: number;
    ok: boolean;
    payload: unknown;
};
export type JsonHttpRequest = {
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
};
export declare function requestJson(url: string, request?: JsonHttpRequest): Promise<JsonHttpResponse>;
