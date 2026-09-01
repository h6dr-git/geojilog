import { describe, expect, it } from "vitest";
import {
  activeUploadDir,
  databaseConnectionConfig,
  externalIntegrationsAllowed,
  resolveLocalModeConfig,
} from "./localMode";

const base = {
  NODE_ENV: "development",
  GEOJILOG_LOCAL_MODE: "1",
  GEOJILOG_LOCAL_OWNER_ID: "2",
  DATABASE_URL: "libsql://must-not-be-used",
  TURSO_AUTH_TOKEN: "must-not-be-used",
  UPLOAD_DIR: "/must/not/be/used",
} satisfies NodeJS.ProcessEnv;

describe("local recovery mode", () => {
  it("forces isolated file paths and ignores remote credentials", () => {
    const config = resolveLocalModeConfig(base, "/workspace/geojilog");
    expect(config).toMatchObject({
      dbPath: "/workspace/geojilog/local-restored.db",
      uploadDir: "/workspace/geojilog/local-restored-uploads",
      ownerId: 2,
    });
    expect(databaseConnectionConfig(base, "/workspace/geojilog")).toEqual({
      url: "file:/workspace/geojilog/local-restored.db",
      mode: "local-recovery",
    });
    expect(activeUploadDir(base, "/workspace/geojilog")).toBe(
      "/workspace/geojilog/local-restored-uploads",
    );
    expect(externalIntegrationsAllowed(base)).toBe(false);
  });

  it("refuses the original database and uploads", () => {
    expect(() =>
      resolveLocalModeConfig(
        { ...base, GEOJILOG_LOCAL_DB: "local.db" },
        "/workspace/geojilog",
      ),
    ).toThrow(/must not point at the original/);
    expect(() =>
      resolveLocalModeConfig(
        { ...base, GEOJILOG_LOCAL_UPLOAD_DIR: "uploads" },
        "/workspace/geojilog",
      ),
    ).toThrow(/must not point at the original/);
  });

  it("is development-only and requires an explicit owner", () => {
    expect(() => resolveLocalModeConfig({ ...base, NODE_ENV: "production" })).toThrow(
      /development-only/,
    );
    expect(() =>
      resolveLocalModeConfig({ ...base, GEOJILOG_LOCAL_OWNER_ID: "" }),
    ).toThrow(/positive integer/);
  });
});
