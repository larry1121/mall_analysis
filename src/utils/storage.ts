import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export class StorageService {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || 'us-east-1';
    
    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || ''
      },
      forcePathStyle: true // MinIO 등 S3 호환 서비스를 위해
    });

    this.bucket = process.env.S3_BUCKET || 'mall-analysis-reports';
  }

  async ping(): Promise<void> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1
      });
      await this.s3Client.send(command);
    } catch (error) {
      // 버킷이 없으면 에러
      throw new Error(`Storage ping failed: ${error}`);
    }
  }

  async upload(key: string, data: Buffer | Readable, contentType?: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType || 'application/octet-stream'
    });

    await this.s3Client.send(command);
    return `s3://${this.bucket}/${key}`;
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        return null;
      }

      // Stream을 Buffer로 변환
      const stream = response.Body as Readable;
      const chunks: Uint8Array[] = [];
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error: any) {
      if (error.Code === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    await this.s3Client.send(command);
  }

  async deletePrefix(prefix: string): Promise<void> {
    // 프리픽스에 해당하는 모든 객체 나열
    const listCommand = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix
    });

    const response = await this.s3Client.send(listCommand);
    
    if (!response.Contents || response.Contents.length === 0) {
      return;
    }

    // 객체들 삭제
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: {
        Objects: response.Contents.map(obj => ({ Key: obj.Key! }))
      }
    });

    await this.s3Client.send(deleteCommand);
  }

  async list(prefix?: string): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Contents) {
      return [];
    }

    return response.Contents.map(obj => obj.Key!);
  }

  async generateSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // AWS SDK v3에서는 @aws-sdk/s3-request-presigner 패키지 필요
    // 여기서는 간단히 public URL 반환
    const endpoint = process.env.S3_ENDPOINT || 'https://s3.amazonaws.com';
    return `${endpoint}/${this.bucket}/${key}`;
  }
}

// 로컬 파일 시스템 스토리지 (개발/테스트용)
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';

export class LocalStorageService {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || join(tmpdir(), 'mall-analysis-storage');
  }

  async ping(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  async upload(key: string, data: Buffer | Readable, contentType?: string): Promise<string> {
    const fullPath = join(this.basePath, key);
    await fs.mkdir(dirname(fullPath), { recursive: true });

    if (Buffer.isBuffer(data)) {
      await fs.writeFile(fullPath, data);
    } else {
      // Stream 처리
      const chunks: Buffer[] = [];
      for await (const chunk of data) {
        // Ensure chunk is a Buffer
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else if (chunk instanceof Uint8Array) {
          chunks.push(Buffer.from(chunk));
        } else if (typeof chunk === 'number') {
          // Single byte as number
          chunks.push(Buffer.from([chunk]));
        } else {
          // String or other types
          chunks.push(Buffer.from(String(chunk)));
        }
      }
      await fs.writeFile(fullPath, Buffer.concat(chunks));
    }

    return `file://${fullPath}`;
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const fullPath = join(this.basePath, key);
      return await fs.readFile(fullPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const fullPath = join(this.basePath, key);
    await fs.unlink(fullPath).catch(() => {});
  }

  async deletePrefix(prefix: string): Promise<void> {
    const fullPath = join(this.basePath, prefix);
    await fs.rm(fullPath, { recursive: true, force: true }).catch(() => {});
  }

  async list(prefix?: string): Promise<string[]> {
    const searchPath = prefix ? join(this.basePath, prefix) : this.basePath;
    
    try {
      const files = await fs.readdir(searchPath, { recursive: true });
      return files.map(f => String(f));
    } catch {
      return [];
    }
  }

  async generateSignedUrl(key: string, expiresIn?: number): Promise<string> {
    const fullPath = join(this.basePath, key);
    return `file://${fullPath}`;
  }
}

let storageInstance: StorageService | LocalStorageService | null = null;

export async function setupStorage(): Promise<void> {
  if (!storageInstance) {
    // S3 설정이 있으면 S3 사용, 없으면 로컬 스토리지
    if (process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY && process.env.S3_BUCKET) {
      try {
        storageInstance = new StorageService();
        await storageInstance.ping();
      } catch (error) {
        console.warn('⚠️  Failed to initialize S3 storage, falling back to local storage:', error);
        storageInstance = new LocalStorageService();
        await storageInstance.ping();
      }
    } else {
      storageInstance = new LocalStorageService();
      await storageInstance.ping();
    }
  }
}

export async function getStorage(): Promise<StorageService | LocalStorageService> {
  if (!storageInstance) {
    await setupStorage();
  }
  return storageInstance!;
}