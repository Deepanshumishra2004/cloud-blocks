import {
  CopyObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../config/env";
import { logger } from "../lib/logger";

const S3_BUCKET = env.S3_BUCKET;
const AWS_REGION = env.AWS_REGION;

const s3 = S3_BUCKET ? new S3Client({ region: AWS_REGION }) : null;

const TEMPLATE_NAME_BY_REPL_TYPE: Record<string, string> = {
  BUN: "bun",
  JAVASCRIPT: "javascript",
  NEXT: "next",
  NODE: "node",
  REACT: "react",
};

export const getTemplateNameForReplType = (replType: string) =>
  TEMPLATE_NAME_BY_REPL_TYPE[replType] ?? replType.toLowerCase();

export const seedReplFromTemplate = async (replId: string, replType: string) => {
  if (!s3 || !S3_BUCKET) {
    logger.warn("[seedReplFromTemplate] S3_BUCKET is not configured, skipping seed");
    return;
  }

  const templateName = getTemplateNameForReplType(replType);
  const sourcePrefix = `template/${templateName}/`;
  const destinationPrefix = `repls/${replId}/${templateName}/`;

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
