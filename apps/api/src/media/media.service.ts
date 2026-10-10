import { Inject, Injectable } from "@nestjs/common";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { ENV, type Env } from "../config/env";

const EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/midi": "mid",
  "audio/x-midi": "mid",
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Presigned object-storage URLs (blueprint §5, functionality §6 "Media handling").
 * Clients PUT/GET directly against the bucket; the API only signs and stores keys.
 * Signing is local — no network call — so it works even when storage is down.
 */
@Injectable()
export class MediaService {
  /** Talks to storage (HEAD/DELETE). */
  private readonly s3: S3Client;
  /** Signs URLs with the browser-facing host. */
  private readonly signer: S3Client;

  constructor(@Inject(ENV) private readonly env: Env) {
    const base = {
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    };
    this.s3 = new S3Client({ ...base, endpoint: env.S3_ENDPOINT });
    this.signer = new S3Client({ ...base, endpoint: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT });
  }

  get ttl() {
    return this.env.MEDIA_URL_TTL_SECONDS;
  }

  /** New object key under a prefix, e.g. "hymns/<hymnId>/<uuid>.mp3". */
  newKey(prefix: string, contentType: string) {
    return `${prefix.replace(/\/+$/, "")}/${randomUUID()}.${EXT[contentType] ?? "bin"}`;
  }

  async presignPut(key: string, contentType: string, bytes: number) {
    const url = await getSignedUrl(
      this.signer,
      new PutObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: key,
        ContentType: contentType,
        ContentLength: bytes,
      }),
      { expiresIn: this.ttl },
    );
    return { key, url, headers: { "content-type": contentType }, expiresInSeconds: this.ttl };
  }

  async presignGet(key: string, downloadName?: string) {
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: key,
        ...(downloadName
          ? {
              ResponseContentDisposition: `attachment; filename="${downloadName.replace(/"/g, "")}"`,
            }
          : {}),
      }),
      { expiresIn: this.ttl },
    );
  }

  /** Size and type of an uploaded object, or null if it isn't there. */
  async head(key: string): Promise<{ bytes: number; contentType: string | null } | null> {
    try {
      const r = await this.s3.send(new HeadObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
      return { bytes: Number(r.ContentLength ?? 0), contentType: r.ContentType ?? null };
    } catch {
      return null;
    }
  }

  async remove(key: string) {
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
    } catch {
      /* orphaned objects are cleaned up by a lifecycle rule (Phase 10) */
    }
  }
}
