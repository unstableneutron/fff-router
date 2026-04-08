export type SupportedBackendId = "fff-node" | "fff-mcp" | "rg";

export type BackendSelection = {
  primaryBackendId: SupportedBackendId;
  fallbackBackendId: SupportedBackendId | null;
};

export function parseBackend(raw: string | undefined): SupportedBackendId {
  const value = raw?.trim() || "fff-node";
  switch (value) {
    case "fff-node":
    case "fff-mcp":
    case "rg":
      return value;
    default:
      throw new Error(`Invalid backend '${value}'. Expected one of: fff-node, fff-mcp, rg`);
  }
}

export function getDefaultFallbackBackend(
  primaryBackendId: SupportedBackendId,
): SupportedBackendId | null {
  switch (primaryBackendId) {
    case "fff-node":
    case "fff-mcp":
      return "rg";
    case "rg":
      return null;
  }
}

export function getBackendSelection(args: { env?: NodeJS.ProcessEnv } = {}): BackendSelection {
  const env = args.env ?? process.env;
  const primaryBackendId = parseBackend(env.FFF_ROUTER_BACKEND);
  return {
    primaryBackendId,
    fallbackBackendId: getDefaultFallbackBackend(primaryBackendId),
  };
}
