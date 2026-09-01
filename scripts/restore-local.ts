import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import {
  chooseNewestSource,
  copyReferencedUploads,
  readBackupSnapshot,
  readRemoteFreshness,
  readRemoteSnapshot,
  restoreSnapshot,
  snapshotCounts,
  verifyRestoredSnapshot,
} from "./local-restore-core";

type CliOptions = {
  source: "auto" | "remote" | "backup";
  ownerId: number;
  backupPath: string;
  outputPath: string;
  sourceUploads: string;
  outputUploads: string;
};

function parseArgs(argv: string[]): CliOptions {
  argv = argv.filter((arg) => arg !== "--");
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument near ${key ?? "end"}`);
    }
    values.set(key.slice(2), value);
  }
  const source = (values.get("source") ?? "auto") as CliOptions["source"];
  if (!new Set(["auto", "remote", "backup"]).has(source)) {
    throw new Error("--source must be auto, remote, or backup");
  }
  const ownerId = Number(values.get("owner-id"));
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    throw new Error("--owner-id must be a positive integer");
  }
  return {
    source,
    ownerId,
    backupPath: path.resolve(
      values.get("backup") ?? "uploads/backups/geojilog-backup-2026-06-15.json",
    ),
    outputPath: path.resolve(values.get("output") ?? "local-restored.db"),
    sourceUploads: path.resolve(values.get("source-uploads") ?? "uploads"),
    outputUploads: path.resolve(values.get("output-uploads") ?? "local-restored-uploads"),
  };
}

function assertFreshTargets(options: CliOptions): void {
  const originalDb = path.resolve("local.db");
  const originalUploads = path.resolve("uploads");
  if (options.outputPath === originalDb) throw new Error("Refusing to overwrite original local.db");
  if (options.outputUploads === originalUploads) {
    throw new Error("Refusing to write into original uploads");
  }
  if (fs.existsSync(options.outputPath)) {
    throw new Error(`Output database already exists: ${options.outputPath}`);
  }
  if (fs.existsSync(options.outputUploads)) {
    throw new Error(`Output uploads already exists: ${options.outputUploads}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertFreshTargets(options);

  const backup = readBackupSnapshot(options.backupPath, options.ownerId);
  const backupFreshness = {
    source: "backup-json" as const,
    ownerId: options.ownerId,
    entries: backup.tables.savings_entries.length,
    newestCreatedAt: backup.newestCreatedAt,
    lastEntryDate: backup.lastEntryDate,
  };

  let remote: ReturnType<typeof createClient> | null = null;
  let remoteFreshness = null;
  if (options.source !== "backup") {
    const remoteUrl = process.env.DATABASE_URL || "";
    if (!remoteUrl.startsWith("libsql:")) {
      if (options.source === "remote") throw new Error("Remote libsql DATABASE_URL is unavailable");
    } else {
      remote = createClient({
        url: remoteUrl,
        authToken: process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN,
      });
      try {
        remoteFreshness = await readRemoteFreshness(remote, options.ownerId);
      } catch (error) {
        remote.close();
        remote = null;
        if (options.source === "remote") throw error;
      }
    }
  }

  const chosen =
    options.source === "backup"
      ? backupFreshness
      : options.source === "remote"
        ? remoteFreshness!
        : chooseNewestSource(backupFreshness, remoteFreshness);
  const snapshot =
    chosen.source === "remote-readonly"
      ? await readRemoteSnapshot(remote!, options.ownerId)
      : backup;
  remote?.close();

  const partialDb = `${options.outputPath}.partial-${process.pid}`;
  const partialUploads = `${options.outputUploads}.partial-${process.pid}`;
  const target = createClient({ url: `file:${partialDb}` });
  await restoreSnapshot(target, snapshot);
  const verification = await verifyRestoredSnapshot(target, snapshot);
  target.close();

  const uploadResult = copyReferencedUploads(
    snapshot,
    options.sourceUploads,
    partialUploads,
  );
  fs.renameSync(partialDb, options.outputPath);
  fs.renameSync(partialUploads, options.outputUploads);

  console.log(
    JSON.stringify(
      {
        source: snapshot.source,
        ownerId: snapshot.ownerId,
        sourceFreshness: {
          entries: snapshot.tables.savings_entries.length,
          lastEntryDate: snapshot.lastEntryDate,
        },
        integrity: verification.integrity,
        counts: snapshotCounts(snapshot),
        uploads: uploadResult,
        externalWrites: 0,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
