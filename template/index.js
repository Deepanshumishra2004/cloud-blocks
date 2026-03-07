import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env"), override: true });

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error("Missing AWS credentials in template/.env");
}

const s3 = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = "cloud-blocks";
const PREFIX = "template";

async function uploadDirectory(localDir, s3Prefix) {
  const entries = fs.readdirSync(localDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(localDir, entry.name);
    const key = `${s3Prefix}/${entry.name}`.replace(/\\/g, "/");

    if (entry.isDirectory()) {
      await uploadDirectory(fullPath, key);
    } else {
      const fileStream = fs.createReadStream(fullPath);

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: fileStream,
        })
      );

      console.log("Uploaded:", key);
    }
  }
}

async function main() {
  await uploadDirectory("./new", PREFIX);
}

main().catch(console.error);
