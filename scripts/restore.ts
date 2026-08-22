#!/usr/bin/env node
// Restore a backup produced by scripts/backup.sh (issue #14).
// Usage: npm run db:restore -- --backup-file <s3-key-or-local-path>
import { execFileSync } from "node:child_process";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";

function parseArgs(argv: string[]): { backupFile?: string } {
  const idx = argv.indexOf("--backup-file");
  return { backupFile: idx !== -1 ? argv[idx + 1] : undefined };
}

async function downloadFromS3(bucket: string, key: string, dest: string, endpointUrl?: string) {
  const args = ["s3", "cp", `s3://${bucket}/${key}`, dest];
  if (endpointUrl) args.splice(2, 0, "--endpoint-url", endpointUrl);
  execFileSync("aws", args, { stdio: "inherit" });
}

async function main() {
  const { backupFile } = parseArgs(process.argv.slice(2));
  if (!backupFile) {
    console.error("Usage: npm run db:restore -- --backup-file <s3-key-or-local-path>");
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  let localPath = backupFile;
  if (!existsSync(backupFile)) {
    const bucket = process.env.BACKUP_S3_BUCKET;
    if (!bucket) {
      console.error(`${backupFile} not found locally, and BACKUP_S3_BUCKET is not set to fetch it remotely`);
      process.exit(1);
    }
    localPath = `/tmp/${backupFile.split("/").pop()}`;
    console.log(`[restore] downloading s3://${bucket}/${backupFile} -> ${localPath}`);
    await downloadFromS3(bucket, backupFile, localPath, process.env.BACKUP_S3_ENDPOINT_URL);
  }

  const sqlPath = localPath.endsWith(".gz") ? localPath.replace(/\.gz$/, "") : localPath;
  if (localPath.endsWith(".gz")) {
    console.log(`[restore] decompressing ${localPath}`);
    await pipeline(createReadStream(localPath), zlib.createGunzip(), createWriteStream(sqlPath));
  }

  console.log(`[restore] applying ${sqlPath} to ${databaseUrl.replace(/:[^:@]*@/, ":***@")}`);
  execFileSync("psql", [databaseUrl, "-f", sqlPath], { stdio: "inherit" });
  console.log("[restore] done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
