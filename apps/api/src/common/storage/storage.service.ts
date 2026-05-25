import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly driver: 's3' | 'local';
  private readonly localDir: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private config: ConfigService) {
    const endpoint = this.config.get<string>('AWS_ENDPOINT_URL');
    this.driver =
      this.config.get<string>('STORAGE_DRIVER') === 'local' ? 'local' : 's3';
    this.localDir = path.resolve(
      process.cwd(),
      '../..',
      this.config.get<string>('LOCAL_STORAGE_DIR') ?? 'uploads',
    );
    this.bucket = this.config.get<string>('S3_BUCKET_NAME') ?? '';

    this.s3 = new S3Client({
      region: this.config.get<string>('AWS_REGION') ?? 'auto',
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
      ...(endpoint && { endpoint, forcePathStyle: true }),
    });
  }

  /**
   * Resolve a storage key to an absolute path and assert it stays within
   * the configured local storage directory.
   * Throws ForbiddenException if the key would escape the storage root.
   */
  private resolveSafeLocalPath(key: string): string {
    const storageRoot = path.resolve(this.localDir);
    const resolved = path.resolve(storageRoot, key);
    if (!resolved.startsWith(storageRoot + path.sep) && resolved !== storageRoot) {
      throw new ForbiddenException('Invalid file key');
    }
    return resolved;
  }

  async upload(
    key: string,
    body: Buffer | Uint8Array | string,
    contentType: string,
  ): Promise<string> {
    if (this.driver === 'local') {
      const filePath = this.resolveSafeLocalPath(key);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, body);
      this.logger.log(`Stored local file ${key} (${contentType})`);
      return key;
    }

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    const endpoint = this.config.get<string>('AWS_ENDPOINT_URL');
    if (endpoint) {
      return `${endpoint}/${this.bucket}/${key}`;
    }
    const region = this.config.get('AWS_REGION');
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (this.driver === 'local') {
      return `/api/v1/files/${encodeURIComponent(key)}`;
    }
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async delete(key: string): Promise<void> {
    if (this.driver === 'local') {
      const filePath = this.resolveSafeLocalPath(key);
      await fs.rm(filePath, { force: true });
      return;
    }
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    return this.upload(key, buffer, contentType);
  }

  getLocalPath(key: string): string {
    return this.resolveSafeLocalPath(key);
  }
}
