import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class ScorecardStorageService {
  private readonly log = new Logger(ScorecardStorageService.name);

  constructor(private readonly config: ConfigService) {}

  async savePdf(leadId: string, buffer: Buffer): Promise<{ url: string }> {
    const fileName = `Franchise-Readiness-${leadId}.pdf`;
    const bucket = this.config.get<string>('s3.bucket') ?? '';

    if (bucket) {
      return this.saveToS3(fileName, buffer);
    }

    const root = join(process.cwd(), 'uploads', 'scorecards');
    await mkdir(root, { recursive: true });
    const diskPath = join(root, fileName);
    await writeFile(diskPath, buffer);

    const base = this.config.get<string>('publicBaseUrl') ?? '';
    if (!base) {
      this.log.warn(
        'PUBLIC_BASE_URL not set — scorecard URL will be a relative path only',
      );
      return { url: `/uploads/scorecards/${fileName}` };
    }
    return { url: `${base}/uploads/scorecards/${fileName}` };
  }

  private async saveToS3(
    fileName: string,
    buffer: Buffer,
  ): Promise<{ url: string }> {
    const bucket = this.config.get<string>('s3.bucket') as string;
    const region = this.config.get<string>('s3.region') ?? 'ap-south-1';
    const key = `scorecards/${fileName}`;

    const client = new S3Client({ region });
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
      }),
    );

    const publicBase = this.config.get<string>('s3.publicBaseUrl');
    if (publicBase) {
      return { url: `${publicBase}/${key}` };
    }
    return {
      url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
    };
  }
}
