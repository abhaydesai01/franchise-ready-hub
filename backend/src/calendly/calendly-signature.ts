import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Calendly webhook signatures: header `Calendly-Webhook-Signature` = `t=<unix>,v1=<hex>`.
 * Signed payload: `${t}.${rawBodyString}` with HMAC-SHA256 using the signing key.
 */
export function verifyCalendlySignature(
  signatureHeader: string | undefined,
  rawBody: Buffer,
  signingKey: string,
): boolean {
  if (!signatureHeader?.trim() || !signingKey?.trim()) return false;

  const parts = signatureHeader.split(',').map((p) => p.trim());
  let t = '';
  const v1s: string[] = [];
  for (const p of parts) {
    if (p.startsWith('t=')) t = p.slice(2);
    if (p.startsWith('v1=')) v1s.push(p.slice(3));
  }
  if (!t || !v1s.length) return false;

  const bodyStr = rawBody.toString('utf8');
  const expectedHex = createHmac('sha256', signingKey)
    .update(`${t}.${bodyStr}`, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expectedHex, 'hex');
  for (const v1 of v1s) {
    try {
      const got = Buffer.from(v1, 'hex');
      if (
        got.length === expectedBuf.length &&
        timingSafeEqual(got, expectedBuf)
      ) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

/** Self-test: signing key works with our verifier (for Settings "Test connection"). */
export function selfTestCalendlySigningKey(signingKey: string): boolean {
  if (!signingKey?.trim() || signingKey.length < 8) return false;
  const t = String(Math.floor(Date.now() / 1000));
  const body = '{"ping":true}';
  const buf = Buffer.from(body, 'utf8');
  const v1 = createHmac('sha256', signingKey)
    .update(`${t}.${body}`, 'utf8')
    .digest('hex');
  const header = `t=${t},v1=${v1}`;
  return verifyCalendlySignature(header, buf, signingKey);
}
