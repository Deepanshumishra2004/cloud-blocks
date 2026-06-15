import {
  CopyObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../config/env";
import { logger } from "../lib/logger";

const S3_BUCKET = env.S3_BUCKET;
const R2_ACCOUNT_ID = env.R2_ACCOUNT_ID;

const s3 = S3_BUCKET && R2_ACCOUNT_ID
  ? new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    })
  : null;

const TEMPLATE_NAME_BY_REPL_TYPE: Record<string, string> = {
  BUN: "bun",
  JAVASCRIPT: "javascript",
  NEXT: "next",
  NODE: "node",
  REACT: "react",
};

export const getTemplateNameForReplType = (replType: string) =>
  TEMPLATE_NAME_BY_REPL_TYPE[replType] ?? replType.toLowerCase();

// Sum the byte size of every object under a user's workspace prefix in R2,
// returned in megabytes. Used by the usage meter. Returns 0 if R2 isn't
// configured. Paginates so users with many files are counted fully.
export const getUserStorageUsageMB = async (userId: string): Promise<number> => {
  if (!s3 || !S3_BUCKET) return 0;

  const prefix = `workspace/${userId}/`;
  let totalBytes = 0;
  let continuationToken: string | undefined;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    for (const item of page.Contents ?? []) {
      totalBytes += item.Size ?? 0;
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return Math.round(totalBytes / (1024 * 1024));
};

export const seedReplFromTemplate = async (replId: string, replType: string, userId: string) => {
  if (!s3 || !S3_BUCKET) {
    logger.warn("[seedReplFromTemplate] R2 storage is not configured, skipping seed");
    return;
  }

  const templateName = getTemplateNameForReplType(replType);
  const sourcePrefix = `template/${templateName}/`;
  const destinationPrefix = `workspace/${userId}/${replId}/`;

  const listed = await s3.send(
    new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: sourcePrefix,
    }),
  );

  const objects = (listed.Contents ?? []).filter(
    (entry) => entry.Key && !entry.Key.endsWith("/"),
  );

  if (objects.length === 0) {
    logger.warn(
      `[seedReplFromTemplate] No template files found at s3://${S3_BUCKET}/${sourcePrefix}`,
    );
    return;
  }

  await Promise.all(
    objects.map((entry) => {
      const sourceKey = entry.Key!;
      const relativePath = sourceKey.slice(sourcePrefix.length);
      const destinationKey = `${destinationPrefix}${relativePath}`;

      return s3.send(
        new CopyObjectCommand({
          Bucket: S3_BUCKET,
          CopySource: `${S3_BUCKET}/${sourceKey}`,
          Key: destinationKey,
        }),
      );
    }),
  );
};
