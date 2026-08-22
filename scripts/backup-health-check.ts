#!/usr/bin/env node
// Verifies the last backup completed within 25 hours (issue #14 - one hour
// of slack over the 24h cadence for a slow run or a delayed cron trigger).
// Reads the S3 object's LastModified via `aws s3api head-object` rather
// than assuming a local file exists (backup.sh runs on a separate cron
// host in production).
import { execFileSync } from "node:child_process";

const MAX_AGE_HOURS = 25;

function latestBackupKey(bucket: string, endpointUrl?: string): string | undefined {
  const args = ["s3api", "list-objects-v2", "--bucket", bucket, "--query", "sort_by(Contents,&LastModified)[-1].Key", "--output", "text"];
  if (endpointUrl) args.push("--endpoint-url", endpointUrl);
  const out = execFileSync("aws", args, { encoding: "utf8" }).trim();
  return out && out !== "None" ? out : undefined;
}

function lastModified(bucket: string, key: string, endpointUrl?: string): Date {
  const args = ["s3api", "head-object", "--bucket", bucket, "--key", key, "--query", "LastModified", "--output", "text"];
  if (endpointUrl) args.push("--endpoint-url", endpointUrl);
  const out = execFileSync("aws", args, { encoding: "utf8" }).trim();
  return new Date(out);
}

function main() {
  const bucket = process.env.BACKUP_S3_BUCKET;
  if (!bucket) {
    console.error("BACKUP_S3_BUCKET is required");
    process.exit(1);
  }
  const endpointUrl = process.env.BACKUP_S3_ENDPOINT_URL;

  const key = latestBackupKey(bucket, endpointUrl);
  if (!key) {
    console.error("[backup-health-check] FAIL: no backups found in bucket");
    process.exit(1);
  }

  const modified = lastModified(bucket, key, endpointUrl);
  const ageHours = (Date.now() - modified.getTime()) / 3_600_000;

  if (ageHours > MAX_AGE_HOURS) {
    console.error(
      `[backup-health-check] FAIL: latest backup (${key}) is ${ageHours.toFixed(1)}h old, exceeds ${MAX_AGE_HOURS}h`
    );
    process.exit(1);
  }

  console.log(`[backup-health-check] OK: latest backup (${key}) is ${ageHours.toFixed(1)}h old`);
}

main();
