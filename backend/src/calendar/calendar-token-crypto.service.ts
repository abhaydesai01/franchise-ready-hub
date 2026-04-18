import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

const IV_LEN = 16;

@Injectable()
export class CalendarTokenCryptoService {
  constructor(private readonly config: ConfigService) {}

  private key(): Buffer {
    const raw = this.config.get<string>('calendarTokenEncryptionKey')?.trim() ?? '';
    if (raw.length < 16) {
      throw new Error(
        'CALENDAR_TOKEN_ENCRYPTION_KEY must be set (at least 16 characters).',
      );
    }
    return scryptSync(raw, 'calendar-token-salt', 32);
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + 16);
    const data = buf.subarray(IV_LEN + 16);
    const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      'utf8',
    );
  }

  encryptOptional(plain: string | undefined | null): string {
    if (!plain) return '';
    return this.encrypt(plain);
  }

  decryptOptional(payload: string | undefined | null): string {
    if (!payload?.trim()) return '';
    try {
      return this.decrypt(payload);
    } catch {
      return '';
    }
  }
}
