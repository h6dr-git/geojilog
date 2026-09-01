import path from "node:path";

const LOCAL_MODE_FLAG = "GEOJILOG_LOCAL_MODE";
const LOCAL_DB_ENV = "GEOJILOG_LOCAL_DB";
const LOCAL_UPLOAD_ENV = "GEOJILOG_LOCAL_UPLOAD_DIR";
const LOCAL_OWNER_ENV = "GEOJILOG_LOCAL_OWNER_ID";

export type LocalModeConfig = {
  enabled: true;
  dbPath: string;
  uploadDir: string;
  ownerId: number;
};

function enabled(env: NodeJS.ProcessEnv): boolean {
  return env[LOCAL_MODE_FLAG] === "1";
}

function resolveIsolatedPath(
  raw: string | undefined,
  fallback: string,
  forbidden: string,
  cwd: string,
  label: string,
): string {
  const resolved = path.resolve(cwd, raw?.trim() || fallback);
  const forbiddenPath = path.resolve(cwd, forbidden);
  if (resolved === forbiddenPath || resolved.startsWith(`${forbiddenPath}${path.sep}`)) {
    throw new Error(`[local-mode] ${label} must not point at the original ${forbidden}`);
  }
  return resolved;
}

/**
 * Fail-closed local recovery mode.
 *
 * It is development-only and refuses to target the original local.db/uploads.
 * Remote credentials may remain in .env, but callers must ignore them whenever
 * this configuration is present.
 */
export function resolveLocalModeConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): LocalModeConfig | null {
  if (!enabled(env)) return null;
  if (env.NODE_ENV === "production") {
    throw new Error("[local-mode] recovery mode is development-only");
  }

  const ownerId = Number(env[LOCAL_OWNER_ENV]);
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    throw new Error(`[local-mode] ${LOCAL_OWNER_ENV} must be a positive integer`);
  }

  return {
    enabled: true,
    dbPath: resolveIsolatedPath(
      env[LOCAL_DB_ENV],
      "local-restored.db",
      "local.db",
      cwd,
      "database",
    ),
    uploadDir: resolveIsolatedPath(
      env[LOCAL_UPLOAD_ENV],
      "local-restored-uploads",
      "uploads",
      cwd,
      "upload directory",
    ),
    ownerId,
  };
}

export function isLocalMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveLocalModeConfig(env) !== null;
}

export function localOwnerId(env: NodeJS.ProcessEnv = process.env): number | null {
  return resolveLocalModeConfig(env)?.ownerId ?? null;
}

export function databaseConnectionConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): { url: string; authToken?: string; mode: "local-recovery" | "default" } {
  const local = resolveLocalModeConfig(env, cwd);
  if (local) {
    return { url: `file:${local.dbPath}`, mode: "local-recovery" };
  }
  return {
    url: env.DATABASE_URL || "file:local.db",
    authToken: env.TURSO_AUTH_TOKEN || env.DATABASE_AUTH_TOKEN,
    mode: "default",
  };
}

export function activeUploadDir(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  return (
    resolveLocalModeConfig(env, cwd)?.uploadDir ||
    env.UPLOAD_DIR ||
    path.resolve(cwd, "uploads")
  );
}

export function externalIntegrationsAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return !isLocalMode(env);
}
