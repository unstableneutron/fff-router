import type { Result, RouterConfig, RoutingTarget } from "./types";
type DeriveArgs = {
    realPath: string;
    statType: "file" | "directory";
    gitRoot: string | null;
    config: RouterConfig;
};
export declare function deriveRoutingTarget(args: DeriveArgs): Result<RoutingTarget>;
export {};
