/**
 * Diagnose mongodb+srv DNS (SRV) from MONGODB_URI in env or argv.
 * Usage: MONGODB_URI='mongodb+srv://...' node scripts/check-atlas-srv.mjs
 */
import dns from 'node:dns/promises';

const uri = process.env.MONGODB_URI || process.argv[2] || '';
const m = uri.match(/^mongodb\+srv:\/\/[^@]*@([^/?]+)/i);
if (!m) {
  console.log('Not a mongodb+srv URI (or empty). Standard mongodb:// URIs skip SRV and avoid this class of error.');
  process.exit(0);
}
const hostPart = m[1];
const srvName = `_mongodb._tcp.${hostPart}`;
console.log('SRV query:', srvName);
try {
  const records = await dns.resolveSrv(srvName);
  console.log('SRV OK:', records);
} catch (e) {
  console.error('SRV FAILED:', e.code || e.message);
  console.error(
    '\nYour machine cannot resolve Atlas SRV records. Atlas IP allowlist (0.0.0.0/0) does NOT fix this.\n' +
      'Fix: use a Standard connection string (mongodb://host1:27017,host2:27017,...) from Atlas,\n' +
      'or change DNS/VPN/firewall (some networks block SRV).\n' +
      'Atlas: Cluster → Connect → Drivers → look for “standard” / non-SRV URI, or Compass export.',
  );
  process.exit(1);
}
