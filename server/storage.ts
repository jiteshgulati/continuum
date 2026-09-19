import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ServiceError } from './ai';

export interface FileStorage {
  put(key: string, content: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
}
export class LocalFileStorage implements FileStorage {
  root: string;
  constructor(root = process.env.UPLOAD_DIR || './data/uploads') {
    this.root = resolve(root);
    mkdirSync(this.root, { recursive: true });
  }
  path(key: string) {
    if (!/^[a-zA-Z0-9-]+\.(pdf|docx|txt|md)$/.test(key))
      throw new ServiceError(400, 'Invalid file key.');
    return resolve(this.root, key);
  }
  async put(key: string, content: Buffer) {
    writeFileSync(this.path(key), content, { flag: 'wx' });
  }
  async read(key: string) {
    return readFileSync(this.path(key));
  }
}
export class S3FileStorage implements FileStorage {
  client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  bucket = process.env.S3_BUCKET;
  constructor() {
    if (!this.bucket) throw new Error('S3_BUCKET must be set when FILE_STORAGE=s3');
  }
  async put(key: string, content: Buffer) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `continuum/${key}`,
        Body: content,
        ContentType: 'application/octet-stream',
        ServerSideEncryption: 'AES256',
      }),
      { abortSignal: AbortSignal.timeout(30000) },
    );
  }
  async read(key: string) {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: `continuum/${key}` }),
      { abortSignal: AbortSignal.timeout(30000) },
    );
    if (!result.Body) throw new ServiceError(404, 'File not found.');
    return Buffer.from(await result.Body.transformToByteArray());
  }
}
export const fileStorage = () =>
  process.env.FILE_STORAGE === 's3' ? new S3FileStorage() : new LocalFileStorage();
